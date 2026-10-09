import { config } from '../../config';

export async function sendLinePush(message: string, targetId?: string): Promise<boolean> {
  const token = config.LINE_CHANNEL_ACCESS_TOKEN;
  const to = targetId || config.LINE_BOSS_TARGET_ID;

  if (!token || !to) {
    console.log('[LINE Mock] 未設定 LINE Token 或目標 ID，訊息:', message);
    return false;
  }

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to,
        messages: [{ type: 'text', text: message }],
      }),
    });

    return res.ok;
  } catch (error) {
    console.error('[LINE Push Error]:', error);
    return false;
  }
}
