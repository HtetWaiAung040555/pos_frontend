import { defineStore } from "pinia";
import axios from "axios";

export const useStatusStore = defineStore('status', {
    state: () => ({
        statusList: [],
        loading: false,
        error: null,
    }),

    actions: {
        async fetchAllStatus() {
            this.loading = true;
            try {
                const response = await axios.get(`/statuses`);
                this.statusList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
    }
});