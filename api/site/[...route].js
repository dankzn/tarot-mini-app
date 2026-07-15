import credentialsStatusHandler from '../../server/site/credentials-status.js';
import credentialsHandler from '../../server/site/credentials.js';
import loginHandler from '../../server/site/login.js';
import logoutHandler from '../../server/site/logout.js';
import passwordResetHandler from '../../server/site/password-reset.js';
import passwordSyncHandler from '../../server/site/password-sync.js';
import passwordHandler from '../../server/site/password.js';
import registerHandler from '../../server/site/register.js';
import sessionHandler from '../../server/site/session.js';
import telegramLoginHandler from '../../server/site/telegram-login.js';
import { tbankInitHandler, tbankNotificationHandler } from '../../server/site/tbank.js';

const routeHandlers = {
  'credentials-status': credentialsStatusHandler,
  credentials: credentialsHandler,
  login: loginHandler,
  logout: logoutHandler,
  'password-reset': passwordResetHandler,
  'password-sync': passwordSyncHandler,
  password: passwordHandler,
  register: registerHandler,
  session: sessionHandler,
  'telegram-login': telegramLoginHandler,
  'tbank-init': tbankInitHandler,
  'tbank-notification': tbankNotificationHandler,
};

const getRouteName = (request) => {
  const route = request.query?.route;

  if (Array.isArray(route)) return route.join('/');
  if (route) return String(route);

  const host = request.headers.host || 'localhost';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const url = new URL(request.url || '/', `${protocol}://${host}`);

  return url.pathname.replace(/^\/api\/site\/?/, '').replace(/\/$/, '');
};

const stripRouterQuery = (request) => {
  if (!request.query || !Object.prototype.hasOwnProperty.call(request.query, 'route')) return;

  const { route, ...cleanQuery } = request.query;
  request.query = cleanQuery;
};

export default async function handler(request, response) {
  const routeName = getRouteName(request);
  const routeHandler = routeHandlers[routeName];

  if (!routeHandler) {
    return response.status(404).json({
      ok: false,
      error: 'Site API route not found',
      route: routeName || null,
    });
  }

  stripRouterQuery(request);
  try {
    return await routeHandler(request, response);
  } catch (error) {
    console.error('Site API route failed:', {
      route: routeName,
      message: error?.message || String(error),
      code: error?.code || null,
      details: error?.details || null,
    });

    return response.status(500).json({
      ok: false,
      error: `Ошибка /api/site/${routeName}: ${error?.message || 'unknown error'}`,
      code: error?.code || null,
      details: error?.details || null,
    });
  }
}
