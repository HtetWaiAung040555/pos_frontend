import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";
import { normalizeApiError } from "@/utils/NormalizeApiError";

const api_url = API_URL;

export const useCounterStore = defineStore('counter', {
    state: () => ({
        counterList: null,
        loading: false,
        deleteLoading: false,
        data: null,
        error: [],
    }),

    actions: {
        async fetchAllCounter() {
            this.loading = true;
            try {
                const response = await axios.get(`/counters`);
                this.counterList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchCounter(counterId) {
            this.loading = true;
            try {
                const response = await axios.get(`/counters/${counterId}`);
                this.counterList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addCounter(formData) {
            this.loading = true;
            try {
                const response = await axios.post(`/counters`, formData);
                this.counterList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editCounter(formData, counterId) {
            this.loading = true;
            try {
                const response = await axios.put(`/counters/${counterId}`, formData)
                this.counterList = response.data.data
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteCounter(counterId) {
            this.deleteLoading = true;
            try {
                const response = await axios.delete(`/counters/${counterId}`);
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        }
    }
});