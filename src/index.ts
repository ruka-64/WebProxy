import { Context, Hono } from 'hono';
import { proxy } from 'hono/proxy';

const app = new Hono();

const baseUrl = 'https://hono.dev';

app.all('*', async (c: Context) => {
  console.log('called');
  const urlObj = new URL(c.req.url);
  const pathNameAndQuery = `${urlObj.pathname}${urlObj.search}`;
  const method = c.req.method;
  const headers = c.req.raw.headers;
  headers.set('host', new URL(baseUrl).host);
  //? fuck
  // headers.set('accept-encoding', 'gzip');
  const body = c.req.raw.body;
  // console.log('headers', headers);
  console.log('body', body);
  const buildedUrl = `${baseUrl}${pathNameAndQuery}`;
  console.log('requesting', buildedUrl);
  const _response = await proxy(buildedUrl, {
    method,
    headers,
    body,
  });

  console.log('encoding', _response.headers.get('content-encoding'));
  // console.log('body', _response.body);

  const response = new Response(_response.body, _response);
  console.log('done');

  response.headers.set('access-control-allow-origin', '*');

  const redirectDetect = response.headers.get('Location');
  if (redirectDetect && redirectDetect.includes(baseUrl)) {
    response.headers.set('Location', redirectDetect.replace(baseUrl, ''));
  }

  return response as unknown as Response;
});

export default {
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
