export const formatDateForDb = (date: Date | string | null, RUNTIME_ENV?: string) => {
  if (!date) return null;
  
  const dateObj = date instanceof Date ? date : new Date(date);

  if(RUNTIME_ENV && RUNTIME_ENV === 'cloudflare-worker'){
    return dateObj.toISOString();
  }

  return dateObj;
};
