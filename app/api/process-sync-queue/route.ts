import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pushExternalTaskUpdate } from '@/lib/external-sync/push';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user to ensure request legitimacy
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão expirada ou não autorizada.' }, { status: 401 });
    }

    // 2. Fetch pending or failed items from the queue for this user
    const { data: queueItems, error: queueErr } = await supabase
      .from('external_sync_queue')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['PENDING', 'FAILED'])
      .order('created_at', { ascending: true })
      .limit(15);

    if (queueErr) {
      console.error('Falha ao carregar fila de sincronização:', queueErr);
      return NextResponse.json({ error: `Erro na leitura da fila: ${queueErr.message}` }, { status: 500 });
    }

    const results = {
      totalProcessed: queueItems?.length || 0,
      succeeded: 0,
      failed: 0,
      details: [] as Array<{ queueId: string; taskId: string; status: string; error?: string }>
    };

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({ message: 'Nenhuma alteração aguardando fila de contingência.', results });
    }

    // 3. Process each queue item sequentially
    for (const item of queueItems) {
      try {
        // Update status of current item to PROCESSING to prevent double processing
        await supabase
          .from('external_sync_queue')
          .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
          .eq('id', item.id);

        const { title, description, completed } = item.payload || {};

        // Run the atomic push operation
        const syncResult = await pushExternalTaskUpdate(supabase, {
          taskId: item.external_task_id,
          userId: item.user_id,
          title,
          description,
          completed
        });

        if (syncResult.success) {
          // Update queue status to SUCCESS
          await supabase
            .from('external_sync_queue')
            .update({ 
              status: 'SUCCESS', 
              updated_at: new Date().toISOString() 
            })
            .eq('id', item.id);

          results.succeeded++;
          results.details.push({
            queueId: item.id,
            taskId: item.external_task_id,
            status: 'SUCCESS'
          });
        } else {
          // Increment retry count and set to FAILED
          const nextRetryCount = (item.retry_count || 0) + 1;
          await supabase
            .from('external_sync_queue')
            .update({ 
              status: 'FAILED', 
              retry_count: nextRetryCount,
              updated_at: new Date().toISOString() 
            })
            .eq('id', item.id);

          results.failed++;
          results.details.push({
            queueId: item.id,
            taskId: item.external_task_id,
            status: 'FAILED',
            error: syncResult.message
          });
        }

      } catch (innerErr: any) {
        console.error(`Erro ao processar item ${item.id} da fila:`, innerErr);
        const nextRetryCount = (item.retry_count || 0) + 1;
        await supabase
          .from('external_sync_queue')
          .update({ 
            status: 'FAILED', 
            retry_count: nextRetryCount,
            updated_at: new Date().toISOString() 
          })
          .eq('id', item.id);

        results.failed++;
        results.details.push({
          queueId: item.id,
          taskId: item.external_task_id,
          status: 'EXCEPTION',
          error: innerErr.message
        });
      }
    }

    return NextResponse.json({ message: 'Processamento de fila finalizado.', results }, { status: 200 });

  } catch (err: any) {
    console.error('Core Process Queue Exception:', err);
    return NextResponse.json({ error: `Erro grave ao processar a fila: ${err.message}` }, { status: 500 });
  }
}
