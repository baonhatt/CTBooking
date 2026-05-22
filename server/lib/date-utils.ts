export const formatDateForDb = (date: Date | string | null) => {
        if (!date) return null;

        const dateObj = date instanceof Date ? date : new Date(date);
        // Store ISO 8601 format with timezone info
        // SQLite stores as TEXT, JS will parse correctly
        return dateObj.toISOString();
};
