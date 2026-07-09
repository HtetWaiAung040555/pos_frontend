import { defineStore } from "pinia";
import axios from "axios";
import { normalizeApiError } from "@/utils/NormalizeApiError";

export const useWalletStore = defineStore('wallet', {
    state: () => ({
        walletList: [],
        loading: false,
        deleteLoading: false,
        data: null,
        error: [],
    }),

    actions: {
        async fetchAllWallet(filteredData) {
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
                    if (filteredData.type !== undefined && filteredData.type !== null && filteredData.type !== '') {
                        params.append('type', filteredData.type);
                    }

                    const query = params.toString();
                    response = await axios.get(query ? `/wallets?${query}` : `/wallets`);
                } else {
                    response = await axios.get(`/wallets`);
                }

                this.walletList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchWallet(walletId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/wallets/${walletId}`);
                this.walletList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addWallet(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/wallets`, formData);
                this.walletList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editWallet(formData, walletId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/wallets/${walletId}`, formData);
                this.walletList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteWallet(walletId) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/wallets/${walletId}`);
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err); 
            } finally {
                this.deleteLoading = false;
            }
        }
    }
});
