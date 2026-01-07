import { defineStore } from "pinia";
import axios from "axios";
import { normalizeApiError } from "@/utils/NormalizeApiError";

export const useLocalInventoryStore = defineStore('Local Inventory', {
    state: () => ({
        stockList: [],
        loading: false,
        error: [],
        data: [],
        deleteLoading: false
    }),

    actions: {
        async fetchAllStock() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/local_inventories`);
                this.stockList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addCloudStock(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/local_inventories`, formData);
                this.stockList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        }
    }
});