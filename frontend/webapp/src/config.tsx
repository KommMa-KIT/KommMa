const isLocal = true;
export const API_BASE_URL = isLocal
  ? 'http://localhost:4000'
  : 'http://localhost:8000'; // The URL from which the information is fetched. Ensure keeping this up to date! (localhost does not work on real server!)

export const SHOW_OUTDATED_DATA_WARNING = false;