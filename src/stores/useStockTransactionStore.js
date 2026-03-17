import { normalizeApiError } from "@/utils/NormalizeApiError";
import axios from "axios";
import { defineStore } from "pinia";

export const useStockTransactionStore = defineStore('Stock Transaction', {
    state: () => ({
        list: [],
        pagination: {
            currentPage: 1,
            lastPage: 1,
            perPage: 50,
            total: 0
        },
        dashboardData: {
            total_in: 0,
            total_out: 0
        },
        exportData: [],
        loading: false,
        deleteLoading: false,
        error: [],
        data: null

    }),
    actions: {
        async fetchStockTransactions(filteredData = {}, page = 1, perPage = 100) {
            this.list = [],
            this.loading = true;
            this.error = [];
            try {

                const params = await this.filteredParams(filteredData, page, perPage);

                const response = await axios.get(`/stock_transactions?${params.toString()}`);

                /* Stock transaction data */
                this.list = response.data.data;

                /* Pagination info */
                this.pagination = {
                    currentPage: response.data.meta.current_page,
                    lastPage: response.data.meta.last_page,
                    perPage: response.data.meta.per_page,
                    total: response.data.meta.total
                };

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
        },
        async exportTransaction(filteredData = {}) {
            this.loading = true;
            this.error = [];
            try {
                const params = await this.filteredParams(filteredData);
                const response = await axios.get(`/stock_transactions/export?${params.toString()}`);
                this.exportData = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchTransactionDashboard(filteredData = {}) {
            this.loading = true;
            this.error = [];
            try {
                const params = await this.filteredParams(filteredData);
                const response = await axios.get(`/stock_transactions/dashboard?${params.toString()}`);
                this.dashboardData = response.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async filteredParams(filteredData = {}, page = 1, perPage = 100) {
            const params = new URLSearchParams();

                /* Date filters */
                if (filteredData.start_date) {
                    params.append("start_date", filteredData.start_date);
                }

                if (filteredData.end_date) {
                    params.append("end_date", filteredData.end_date);
                }

                /* Other filters */
            
                if (filteredData.referenceType) {
                    params.append("reference_type", filteredData.referenceType);
                }

                if (filteredData.type) {
                    params.append("type", filteredData.type);
                }

                if (filteredData.product) {
                    params.append("product_search", filteredData.product);
                }

                if (filteredData.referenceId) {
                    params.append("reference_id", filteredData.referenceId);
                }

                /* Pagination */
                params.append("page", page);
                params.append("per_page", perPage);

                return params;
        }
    }

});
