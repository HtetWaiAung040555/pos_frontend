function detailText(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
        return value.map(detailText).filter(Boolean).join('; ');
    }

    if (typeof value === 'object') {
        const nestedMessage = detailText(value.message);
        if (nestedMessage) return nestedMessage;

        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    return String(value);
}

function serverErrorDetails(res) {
    const data = res.data;
    const statusLabel = `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
    const messages = [];
    const addDetail = (label, value) => {
        const text = detailText(value);
        if (!text) return;

        const entry = `${label}: ${text}`;
        if (!messages.includes(entry)) messages.push(entry);
    };

    if (typeof data === 'string') {
        addDetail('Response', data);
    } else {
        addDetail('Message', data?.message);
        addDetail('Error', data?.error);
        addDetail('Details', data?.details);
        addDetail('Exception', data?.exception);

        if (data?.file) {
            addDetail('Location', `${data.file}${data.line ? `:${data.line}` : ''}`);
        }

        const firstTrace = Array.isArray(data?.trace) ? data.trace[0] : null;
        if (!data?.file && firstTrace?.file) {
            addDetail('Location', `${firstTrace.file}${firstTrace.line ? `:${firstTrace.line}` : ''}`);
        }
    }

    const requestId = res.headers?.['x-request-id']
        ?? res.headers?.['x-correlation-id']
        ?? res.headers?.['request-id'];
    addDetail('Request ID', requestId);

    if (!messages.length) {
        messages.push('The server response did not include an error message or exception detail.');
    }

    return [`${statusLabel} — ${messages.join(' | ')}`];
}

export function normalizeApiError(err) {
    const res = err.response;

    if (!res) {
        return ['Network error'];
    }

    // 422 -> validation / business errors
    if (res.status === 422 && res.data?.errors) {
        return Object.values(res.data.errors).flat();
    }

    if (res.status === 422 && res.data?.error) {
        const blockers = Array.isArray(res.data.blockers) ? res.data.blockers : [];
        const blockerMessage = blockers.length
            ? ` Blocked by: ${blockers.join(', ')}.`
            : '';
        return [`${res.data.error}${blockerMessage}`];
    }

    // 401 -> login error
    if(res.status === 401) {
        return [res.data?.message || 'Email or password incorrect.']
    }

    if (res.status === 403) {
        return [res.data?.message || 'You do not have permission to perform this action.'];
    }

    if (res.status === 409) {
        return [res.data?.message || 'The record changed and this action can no longer be completed.'];
    }

    // Preserve every useful field sent by the backend for server failures.
    if (res.status >= 500) {
        return serverErrorDetails(res);
    }

    // fallback
    return [res.data?.message || res.data?.error || 'Unexpected error occurred'];
}
