import { normalizeApiError } from "@/utils/NormalizeApiError";
import axios from "axios";
import { defineStore } from "pinia";

export const usePurchaseStore = defineStore('purchase', {
    state: () => ({
        purchaseList: [],
        pagination: {
            currentPage: 1,
            lastPage: 1,
            perPage: 50,
            total: 0
        },
        dashboardData: {
            total_invoice: 0,
            total_purchases: 0,
            total_cash: 0,
            total_kpay: 0,
            total_credit: 0
        },
        exportData: [],
        loading: false,
        deleteLoading: false,
        error: [],
        data: null

    }),
    actions: {
        async fetchAllPurchase(filteredData = {}, page = 1, perPage = 100) {
            this.loading = true;
            this.error = [];
            try {
                const params = await this.filteredParams(filteredData, page, perPage);

                const response = await axios.get(`/purchases?${params.toString()}`);

                /* Purchase data */
                this.purchaseList = response.data.data;

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
        async fetchPurchase(id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/purchases/${id}`);
                this.purchaseList = response.data.data;
            } catch (err) {
               this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchPurchaseByStatus(status) {
            this.loading = true;
            try {
                const response = await axios.get(`/purchases?status_id=${status}`);
                this.purchaseList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addPurchase(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/purchases`, formData);
                this.purchaseList = response.data.data;
            } catch(err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editPurchase(formData, id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/purchases/${id}`, formData)
                this.purchaseList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deletePurchase(data, id) {
            this.deleteLoading = true;
            try {
                const response = await axios.delete(`/purchases/${id}`, { data: data });
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        },
        async exportPurchases(filteredData = {}) {
            this.loading = true;
            this.error = [];
            try {
                const params = await this.filteredParams(filteredData);
                const response = await axios.get(`/purchases/export?${params.toString()}`);
                this.exportData = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchDashboardPurchases(filteredData = {}) {
            this.loading = true;
            this.error = [];
            try {
                const params = await this.filteredParams(filteredData);
                const response = await axios.get(`/purchases/dashboard?${params.toString()}`);
                this.dashboardData = response.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async filteredParams(filteredData = {}, page = 1, perPage = 100) {
            const params = new URLSearchParams();

                console.log("Filtered Data in Store:", filteredData);

                /* Date filters */
                if (filteredData.start_date) {
                    params.append("start_date", filteredData.start_date);
                }

                if (filteredData.end_date) {
                    params.append("end_date", filteredData.end_date);
                }

                /* Other filters */
                if (filteredData.supplier) {
                    params.append("supplier_search", filteredData.supplier);
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
                    params.append("purchase_id", filteredData.invoice);
                }

                /* Pagination */
                params.append("page", page);
                params.append("per_page", perPage);

                return params;
        }
    }

});