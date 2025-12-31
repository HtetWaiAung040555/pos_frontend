import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";
import { normalizeApiError } from "@/utils/NormalizeApiError";

const api_url = API_URL;

export const usePriceChangeStore = defineStore('Price Change', {
    state: () => ({
        priceChangeList: [],
        loading: false,
        deleteLoading: false,
        data: [],
        error: [],
    }),

    actions: {
        async fetchAllPriceChange() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/pricechanges`);
                this.priceChangeList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchPriceChange(id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/pricechanges/${id}`);
                this.priceChangeList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addPriceChange(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/pricechanges`, formData);
                this.priceChangeList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editPriceChange(formData, id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/pricechanges/${id}`, formData);
                this.priceChangeList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deletePriceChange(data, id) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/pricechanges/${id}`, {data: data});
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        }
    }
});