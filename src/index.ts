import { Context, Hono } from 'hono';
import { proxy } from 'hono/proxy';
import { MAX_TIME, PORT } from '../config';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const app = new Hono();

let baseUrl = 'https://ruka64.dev';
let isRunning = false;
const maxTimeSec = MAX_TIME ?? 300;
let remain = 0;

interface WebProxyPostT {
  url: string;
}

async function timer() {
  if (remain === 0) return;
  while (remain !== 0) {
    // console.log('[Dev] idle timer', remain);
    remain--;
    await delay(1000);
  }
  isRunning = false;
  return;
}

app.post('/webproxy', async (c) => {
  const body = (await c.req.json()) as WebProxyPostT;
  if (!body) {
    return c.json(
      {
        success: false,
        message: 'Invalid body',
      },
      400
    );
  }
  if (isRunning) {
    return c.json(
      {
        success: false,
        message: 'This node is busy',
      },
      400
    );
  }
  const url = new URL(body.url);
  console.log(
    `[${new Date().toLocaleString}] Proxy started. target: ${url.origin}`
  );
  isRunning = true;
  baseUrl = url.origin;
  remain = maxTimeSec;
  timer();
  return c.json({
    success: true,
    message: 'OK',
  });
});

app.all('*', async (c: Context) => {
  if (c.req.path === '/webproxy' && c.req.method === 'POST') {
    return;
  }
  if (!isRunning) {
    c.res.headers.set('Cache-Control', 'max-age=0');
    return c.redirect('https://webproxy.ruka64.dev/', 301);
  }
  remain = maxTimeSec;
  const urlObj = new URL(c.req.url);
  const pathNameAndQuery = `${urlObj.pathname}${urlObj.search}`;
  const method = c.req.method;
  const headers = c.req.raw.headers;
  headers.set('host', new URL(baseUrl).host);
  const body = c.req.raw.body;
  const buildedUrl = `${baseUrl}${pathNameAndQuery}`;
  const _response = await proxy(buildedUrl, {
    method,
    headers,
    body,
  });

  const response = new Response(_response.body, _response);

  response.headers.set('access-control-allow-origin', '*');

  const redirectDetect = response.headers.get('Location');
  if (redirectDetect && redirectDetect.includes(baseUrl)) {
    response.headers.set('Location', redirectDetect.replace(baseUrl, ''));
  }
  response.headers.set('Cache-Control', 'max-age=120');

  return response as unknown as Response;
});

export default {
  port: PORT ?? 3000,
  //@ts-ignore
  async fetch(request, env, ctx): Promise<Response> {
    const urlObj = new URL(request.url);
    console.log(
      `[LOG]:"${request.method}":"${new Date().getTime()}":"${urlObj.pathname}${
        urlObj.search
      }"`
    );
    return app.fetch(request, env, ctx);
  },
};
