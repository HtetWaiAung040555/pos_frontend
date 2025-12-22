import { defineStore } from "pinia";
import axios from "axios";
import { normalizeApiError } from "@/utils/NormalizeApiError";

export const useStatusStore = defineStore('status', {
    state: () => ({
        statusList: [],
        loading: false,
        error: [],
    }),

    actions: {
        async fetchAllStatus() {
            this.loading = true;
            try {
                const response = await axios.get(`/statuses`);
                this.statusList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
    }
});