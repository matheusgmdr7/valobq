import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgrhgkqpqsnkhewnmarr.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    return createClient(url, anonKey);
  }

  return createClient(url, serviceKey);
}

// GET - Buscar chats do usuário ou mensagens de um chat
export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const chatId = searchParams.get('chatId');

    // Se chatId fornecido, buscar mensagens desse chat
    if (chatId) {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ data });
    }

    // Se userId fornecido, buscar chats do usuário
    if (userId) {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: 'userId ou chatId é obrigatório' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Criar chat ou enviar mensagem
export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const body = await request.json();
    const { action } = body;

    if (action === 'create-chat') {
      const { userId, subject } = body;
      if (!userId) {
        return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('chats')
        .insert({
          user_id: userId,
          status: 'waiting',
          subject: subject || 'Nova conversa',
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ data });
    }

    if (action === 'send-message') {
      const { chatId, userId, message, isFromSupport } = body;
      if (!chatId || !userId || !message) {
        return NextResponse.json({ error: 'chatId, userId e message são obrigatórios' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatId,
          user_id: userId,
          message,
          is_from_support: isFromSupport || false,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: 'action inválida (use create-chat ou send-message)' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
