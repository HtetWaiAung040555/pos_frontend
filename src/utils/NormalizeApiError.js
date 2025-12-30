export function normalizeApiError(err) {
    const res = err.response;

    if (!res) {
        return ['Network error'];
    }

    // 422 → validation / business errors
    if (res.status === 422 && res.data?.errors) {
        return Object.values(res.data.errors).flat();
    }

    // 401 -> login error
    if(res.status === 401) {
        return [res.data?.message || 'Email or password incorrect.']
    }

    // 500 → server error
    if (res.status === 500) {
        return [res.data?.details || 'Server error'];
    }

    // fallback
    return ['Unexpected error occurred'];
}