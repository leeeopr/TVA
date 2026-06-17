import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pushExternalTaskUpdate, pushExternalTaskDeletion } from '@/lib/external-sync/push';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão expirada ou não autorizada.' }, { status: 401 });
    }

    const body = await req.json();
    const { operation, taskId, title, description, completed, deleteRemote } = body;

    if (!taskId) {
      return NextResponse.json({ error: 'ID da tarefa externa (taskId) é obrigatório.' }, { status: 400 });
    }

    if (operation === 'DELETE') {
      const result = await pushExternalTaskDeletion(supabase, {
        taskId,
        userId: user.id,
        deleteRemote: !!deleteRemote
      });

      return NextResponse.json(result, { status: result.success ? 200 : 500 });
    } else {
      // DEFAULT TO UPDATE/PUSH
      const result = await pushExternalTaskUpdate(supabase, {
        taskId,
        userId: user.id,
        title,
        description,
        completed
      });

      return NextResponse.json(result, { status: result.success ? 200 : 200 }); // Return 200 even with contingency queuing so client is unblocked
    }

  } catch (err: any) {
    console.error('API Sync Push Error:', err);
    return NextResponse.json({ error: `Falha interna no sincronizador reverso: ${err.message}` }, { status: 500 });
  }
}
