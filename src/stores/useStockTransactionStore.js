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
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/stock_transactions?start_date=${filteredData.start_date}&end_date=${filteredData.end_date}&${filteredData.reference_type? reference_type = filteredData.reference_type: ""}`);
                this.list = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        }
    }

});