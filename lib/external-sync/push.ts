import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface PushOptions {
  taskId: string;
  userId: string;
  title?: string;
  description?: string;
  completed?: boolean;
}

/**
 * Registra um log de sincronização em external_sync_logs
 */
export async function logSync(supabaseClient: any, payload: {
  userId: string;
  sourceId: string;
  externalTaskId: string | null;
  direction: 'PUSH' | 'PULL';
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  success: boolean;
  message?: string;
}) {
  try {
    const { error } = await supabaseClient
      .from('external_sync_logs')
      .insert({
        user_id: payload.userId,
        source_id: payload.sourceId,
        external_task_id: payload.externalTaskId,
        direction: payload.direction,
        operation: payload.operation,
        success: payload.success,
        message: payload.message || null,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Falha ao gravar log de sincronização no banco:', error);
    }
  } catch (err) {
    console.error('Falha catastrófica ao gravar log:', err);
  }
}

/**
 * Adiciona uma alteração à fila de sincronização external_sync_queue em caso de falha
 */
export async function enqueueSync(supabaseClient: any, payload: {
  userId: string;
  externalTaskId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  status?: 'PENDING' | 'FAILED';
}) {
  try {
    // Check if there is already a pending/failed entry for this task to avoid queue bloat
    const { data: existing, error: checkErr } = await supabaseClient
      .from('external_sync_queue')
      .select('id, retry_count')
      .eq('external_task_id', payload.externalTaskId)
      .in('status', ['PENDING', 'FAILED'])
      .maybeSingle();

    if (!checkErr && existing) {
      // Update existing queue entry with new operations and merge payloads
      const { error: updateErr } = await supabaseClient
        .from('external_sync_queue')
        .update({
          operation: payload.operation,
          payload: { ...existing.payload, ...payload.data },
          status: 'PENDING',
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (updateErr) throw updateErr;
    } else {
      // Insert new queue record
      const { error: insertErr } = await supabaseClient
        .from('external_sync_queue')
        .insert({
          user_id: payload.userId,
          external_task_id: payload.externalTaskId,
          operation: payload.operation,
          payload: payload.data,
          status: payload.status || 'PENDING',
          retry_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertErr) throw insertErr;
    }
  } catch (err: any) {
    console.error('Falha ao incluir na fila de sincronização:', err.message);
  }
}

/**
 * Executa a sincronização reversa (PUSH) de uma alteração de tarefa externa
 */
export async function pushExternalTaskUpdate(
  supabaseClient: any, 
  options: PushOptions
): Promise<{ success: boolean; message: string }> {
  const { taskId, userId, title, description, completed } = options;

  try {
    // 1. Obter a tarefa externa local para pegar ids e metadados
    const { data: extTask, error: taskErr } = await supabaseClient
      .from('external_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskErr || !extTask) {
      return { success: false, message: `Tarefa externa ${taskId} não encontrada no TVA local` };
    }

    const { source_id: sourceId, external_id: externalId, metadata } = extTask;

    // 2. Obter as credenciais da fonte externa
    const { data: source, error: sourceErr } = await supabaseClient
      .from('external_sources')
      .select('*')
      .eq('id', sourceId)
      .single();

    if (sourceErr || !source) {
      return { success: false, message: `Fonte externa do canal correspondente não encontrada ou inativa.` };
    }

    const alias = source.secret_alias;
    if (!alias) {
      return { success: false, message: `O alias de configuração não foi informado para a fonte externa: ${source.name}.` };
    }

    const url = process.env[`${alias}_SUPABASE_URL`];
    const key = process.env[`${alias}_SUPABASE_KEY`];

    if (!url || !key) {
      return { 
        success: false, 
        message: `Credenciais do Supabase não encontradas no ambiente para o alias: ${alias}. Certifique-se de configurar ${alias}_SUPABASE_URL e ${alias}_SUPABASE_KEY.` 
      };
    }

    // 3. Criar cliente temporário isolado por operação (MANDATÓRIO)
    const externalClient = createSupabaseClient(
      url,
      key,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );

    // 4. Montar o payload remoto com base na assinatura detectada
    const remotePayload: any = {
      updated_at: new Date().toISOString()
    };

    if (title !== undefined) remotePayload.title = title;
    if (description !== undefined) remotePayload.description = description;
    
    if (completed !== undefined) {
      // Normalização dinâmica baseada em chaves existentes vistas nos metadados
      const metadataKeys = Object.keys(metadata || {});
      if (metadataKeys.includes('is_completed')) {
        remotePayload.is_completed = completed;
      } else {
        remotePayload.completed = completed;
      }
    }

    // Determinar operação a registrar
    const operation = 'UPDATE';

    // 5. Enviar a alteração para a origem remota
    const { error: remoteErr } = await externalClient
      .from('tasks')
      .update(remotePayload)
      .eq('id', externalId);

    if (remoteErr) {
      throw new Error(`Erro no banco remoto do cliente: ${remoteErr.message}`);
    }

    // 6. Atualizar a tarefa local com proteção anti-loop temporal e direcional
    const { error: finalLocalErr } = await supabaseClient
      .from('external_tasks')
      .update({
        last_sync_direction: 'PUSH',
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Atualizar campos locais correspondentes se atualizados com sucesso
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(completed !== undefined ? { completed } : {})
      })
      .eq('id', taskId);

    if (finalLocalErr) {
      console.warn('Alerta: falha ao atualizar last_sync_direction localmente:', finalLocalErr.message);
    }

    // 7. Gravar log de sucesso
    await logSync(supabaseClient, {
      userId,
      sourceId,
      externalTaskId: taskId,
      direction: 'PUSH',
      operation,
      success: true,
      message: 'Propagação de alterações executada com sucesso.'
    });

    return { success: true, message: 'Operações sincronizadas com a origem com sucesso.' };

  } catch (err: any) {
    console.error('Falha na sincronização reversa PUSH:', err);

    // 8. Tentar obter os dados mínimos para logar e criar fila se não for resolvido
    try {
      const { data: extTask } = await supabaseClient
        .from('external_tasks')
        .select('source_id')
        .eq('id', taskId)
        .maybeSingle();

      if (extTask) {
        // Registrar falha em external_sync_logs
        await logSync(supabaseClient, {
          userId,
          sourceId: extTask.source_id,
          externalTaskId: taskId,
          direction: 'PUSH',
          operation: 'UPDATE',
          success: false,
          message: err.message || 'Erro inesperado na sincronização.'
        });

        // Registrar falha na fila de reenvio external_sync_queue
        await enqueueSync(supabaseClient, {
          userId,
          externalTaskId: taskId,
          operation: 'UPDATE',
          data: { title, description, completed },
          status: 'FAILED'
        });
      }
    } catch (fallbackErr) {
      console.error('Erro ao processar contingência após falha de rede:', fallbackErr);
    }

    return { success: false, message: `Falha na sincronização: ${err.message}. Guardado na fila de contingência.` };
  }
}

/**
 * Propaga deleção bidirecional do TVA para a origem externa
 */
export async function pushExternalTaskDeletion(
  supabaseClient: any,
  options: { taskId: string; userId: string; deleteRemote: boolean }
): Promise<{ success: boolean; message: string }> {
  const { taskId, userId, deleteRemote } = options;

  try {
    // 1. Pegar dados da tarefa antes de excluir
    const { data: extTask, error: taskErr } = await supabaseClient
      .from('external_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskErr || !extTask) {
      return { success: false, message: 'Tarefa de origem não encontrada localmente no TVA.' };
    }

    const { source_id: sourceId, external_id: externalId } = extTask;

    // 2. Se o usuário escolheu deletar também na origem remota
    if (deleteRemote) {
      // Obter credenciais da fonte
      const { data: source, error: sourceErr } = await supabaseClient
        .from('external_sources')
        .select('*')
        .eq('id', sourceId)
        .single();

      if (!sourceErr && source) {
        const alias = source.secret_alias;
        if (!alias) {
          throw new Error(`O alias de configuração não foi informado para a fonte externa: ${source.name}.`);
        }

        const url = process.env[`${alias}_SUPABASE_URL`];
        const key = process.env[`${alias}_SUPABASE_KEY`];

        if (!url || !key) {
          throw new Error(`Credenciais do Supabase não encontradas no ambiente para o alias: ${alias}. Certifique-se de configurar ${alias}_SUPABASE_URL e ${alias}_SUPABASE_KEY.`);
        }

        // Criar cliente temporário isolado por operação
        const externalClient = createSupabaseClient(
          url,
          key,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            }
          }
        );

        // Executar deleção remota
        const { error: deleteRemoteErr } = await externalClient
          .from('tasks')
          .delete()
          .eq('id', externalId);

        if (deleteRemoteErr) {
          throw new Error(`Falha ao excluir tarefa no cliente remoto: ${deleteRemoteErr.message}`);
        }

        // Gravar log de deleção remota sucesso
        await logSync(supabaseClient, {
          userId,
          sourceId,
          externalTaskId: null,
          direction: 'PUSH',
          operation: 'DELETE',
          success: true,
          message: 'Deleção remota concluída com êxito.'
        });
      }
    }

    // 3. Excluir fisicamente ou logicamente a tarefa do TVA para não duplicar de forma alguma
    const { error: finalDeleteErr } = await supabaseClient
      .from('external_tasks')
      .delete()
      .eq('id', taskId);

    if (finalDeleteErr) {
      throw finalDeleteErr;
    }

    return { 
      success: true, 
      message: deleteRemote 
        ? 'Tarefa removida com sucesso de ambos os sistemas!' 
        : 'Tarefa removida com sucesso do TVA local (preservada na origem).'
    };

  } catch (err: any) {
    console.error('Falha na deleção bidirecional:', err);

    return { success: false, message: `Erro ao realizar deleção: ${err.message}` };
  }
}
