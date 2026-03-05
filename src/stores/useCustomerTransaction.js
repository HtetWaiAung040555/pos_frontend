import { defineStore } from "pinia";
import axios from "axios";
import { normalizeApiError } from "@/utils/NormalizeApiError";

export const useCustomerTransactionStore = defineStore('customerTransaction', {
    state: () => ({
        dataList: [],
        loading: false,
        error: [],
    }),

    actions: {
        async fetchAllTransaction(filteredData) {
            this.loading = true;
            this.error = [];
            try {
                const hasFilters = filteredData && Object.keys(filteredData).length > 0;
                let response;

                if (hasFilters) {
                    const params = new URLSearchParams();

                    if (filteredData.start_date) params.append('start_date', filteredData.start_date);
                    if (filteredData.end_date) params.append('end_date', filteredData.end_date);
                    if (filteredData.customer_id !== undefined && filteredData.customer_id !== null && filteredData.customer_id !== '') {
                        params.append('customer_id', filteredData.customer_id);
                    }
                    if (filteredData.status_id !== undefined && filteredData.status_id !== null && filteredData.status_id !== '') {
                        params.append('status_id', filteredData.status_id);
                    }

                    const query = params.toString();
                    response = await axios.get(query ? `/customers_transactions?${query}` : `/customers_transactions`);
                } else {
                    response = await axios.get(`/customers_transactions`);
                }

                this.dataList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        }
    }
});