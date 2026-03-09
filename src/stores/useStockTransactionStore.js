import { normalizeApiError } from "@/utils/NormalizeApiError";
import axios from "axios";
import { defineStore } from "pinia";

export const useStockTransactionStore = defineStore('Stock Transaction', {
    state: () => ({
        list: [],
        loading: false,
        deleteLoading: false,
        error: [],
        data: null

    }),
    actions: {
        async fetchStockTransactions(filteredData) {
            this.list = [],
            this.loading = true;
            this.error = [];
            try {
                const params = new URLSearchParams({
                    start_date: filteredData.start_date || "",
                    end_date: filteredData.end_date || "",
                });
                if (filteredData.reference_type) {
                    params.set("reference_type", filteredData.reference_type);
                }
                const response = await axios.get(`/stock_transactions?${params.toString()}`);
                this.list = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteStockAdjust(id) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/stock_transactions/${id}`);
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        }
    }

});
