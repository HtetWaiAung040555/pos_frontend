import { normalizeApiError } from "@/utils/NormalizeApiError";
import axios from "axios";
import { defineStore } from "pinia";

export const useSaleStore = defineStore('sales', {
    state: () => ({
        salesList: [],
        pagination: {
            currentPage: 1,
            lastPage: 1,
            perPage: 50,
            total: 0
        },
        dashboardData: {
            total_invoice: 0,
            total_sales: 0,
            total_cash: 0,
            total_kpay: 0,
            total_wallet: 0
        },
        exportData: [],
        loading: false,
        deleteLoading: false,
        error: [],
        data: null

    }),
    actions: {
        async fetchAllSales(filteredData = {}, page = 1, perPage = 100) {
            this.loading = true;
            this.error = [];

            try {

                const params = await this.filteredParams(filteredData, page, perPage);

                const response = await axios.get(`/sales?${params.toString()}`);

                /* Sales data */
                this.salesList = response.data.data;

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
        async fetchSales(id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/sales/${id}`);
                this.salesList = response.data.data;
            } catch (err) {
               this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchSalesByStatus(status) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/sales?status_id=${status}`);
                this.salesList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addSales(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/sales`, formData);
                this.salesList = response.data.data;
            } catch(err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editSales(formData, id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/sales/${id}`, formData)
                this.salesList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteSales(data, id) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/sales/${id}`, { data: data });
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        },
        async exportSales(filteredData = {}) {
            this.loading = true;
            this.error = [];
            try {
                const params = await this.filteredParams(filteredData);
                const response = await axios.get(`/sales/export?${params.toString()}`);
                this.exportData = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchDashboardSales(filteredData = {}) {
            this.loading = true;
            this.error = [];
            try {
                const params = await this.filteredParams(filteredData);
                const response = await axios.get(`/sales/dashboard?${params.toString()}`);
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
                if (filteredData.customer) {
                    params.append("customer_search", filteredData.customer);
                }

                if (filteredData.statusId) {
                    params.append("status_id", filteredData.statusId);
                }

                if (filteredData.paymentId) {
                    params.append("payment_id", filteredData.paymentId);
                }

                if (filteredData.warehouseId) {
                    params.append("warehouse_id", filteredData.warehouseId);
                }

                if (filteredData.product) {
                    params.append("product_search", filteredData.product);
                }

                if (filteredData.invoice) {
                    params.append("sale_id", filteredData.invoice);
                }

                /* Pagination */
                params.append("page", page);
                params.append("per_page", perPage);

                return params;
        }
    }

});