import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";
import { normalizeApiError } from "@/utils/NormalizeApiError";

const api_url = API_URL;

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
                let response;
                if (filteredData) {
                    response = await axios.get(`/customers_transactions?start_date=${filteredData.start_date}&end_date=${filteredData.end_date}&${filteredData.customer_id? customer_id=filteredData.customer_id : ""}`);
                    this.walletList = response.data.data;
                } else {
                    response = await axios.get(`/customers_transactions`);
                    this.walletList = response.data.data;
                }
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
                const response = await axios.get(`/customers_transactions/${walletId}`);
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
                const response = await axios.post(`/customers_transactions`, formData);
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
                const response = await axios.put(`/customers_transactions/${walletId}`, formData);
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
                const response = await axios.delete(`/customers_transactions/${walletId}`);
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err); 
            } finally {
                this.deleteLoading = false;
            }
        }
    }
});