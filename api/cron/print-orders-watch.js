// Hourly cron (see vercel.json). Logic: api/_lib/orders/cron.js
import { watchHandler } from '../_lib/orders/cron.js';

export default watchHandler();
