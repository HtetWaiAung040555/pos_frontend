import axios from "axios";
import { defineStore } from "pinia";

export const useStockTransactionStore = defineStore('Stock Transaction', {
    state: () => ({
        list: [],
        loading: false,
        deleteLoading: false,
        error: null,
        data: null

    }),
    actions: {
        async fetchStockTransactions(filteredData) {
            this.loading = true;
            try {
                console.log(filteredData);
                const response = await axios.get(`/stock_transactions?reference_type=${filteredData.reference_type}&start_date=${filteredData.start_date}&end_date=${filteredData.end_date}`);
                console.log(response.data.data);
                this.list = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        }
    }

});