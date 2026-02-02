import { defineStore } from "pinia";
import axios from "axios";
import { normalizeApiError } from "@/utils/NormalizeApiError";

export const useStatusStore = defineStore('status', {
    state: () => ({
        statusList: [],
        statusMap: {},
        loading: false,
        error: [],
    }),

    actions: {
        async fetchAllStatus() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/statuses`);
                this.statusList = response.data.data;

                // Create a map for easy lookup by ID
                this.statusMap = {};
                for (const status of this.statusList) {
                    this.statusMap[status.name] = status.id;
                }
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },

        getStatusId(name) {
            return this.statusMap[name] || null;
        }
    }
});