type ApiMode = 'stub' | 'local' | 'prod';

const API_TARGETS: Record<ApiMode, string> = {
  stub: 'http://localhost:4000',
  local: 'http://localhost:8000',
  prod: 'https://www.kommma.com/api',
};

const mode = (process.env.REACT_APP_API_MODE as ApiMode | undefined) ?? 'local';

export const API_BASE_URL = API_TARGETS[mode];

export const SHOW_OUTDATED_DATA_WARNING = false;