import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";
import { normalizeApiError } from "@/utils/NormalizeApiError";

const api_url = API_URL;

export const useUnitStore = defineStore('Unit', {
    state: () => ({
        unitList: null,
        loading: false,
        deleteLoading: false,
        data: null,
        error: [],
    }),

    actions: {
        async fetchAllUnit() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/units`);
                this.unitList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchUnit(id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/units/${id}`);
                this.unitList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addUnit(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/units`, formData);
                this.unitList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editUnit(formData, paymentMethodId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/units/${paymentMethodId}`, formData);
                this.unitList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteUnit(id) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/units/${id}`);
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err); 
            } finally {
                this.deleteLoading = false;
            }
        }
    }
});