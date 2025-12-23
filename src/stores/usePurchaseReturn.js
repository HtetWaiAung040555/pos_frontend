import { defineStore } from "pinia";
import axios from "axios";
import { normalizeApiError } from "@/utils/NormalizeApiError";

export const usePurchaseReturnStore = defineStore('Purchase Return', {
    state: () => ({
        returnList: [],
        loading: false,
        error: [],
        data: [],
        deleteLoading: false
    }),

    actions: {
        async fetchAllPurchaseReturn(filteredData) {
            this.loading = true;
            this.error = [];
            try {
                console.log(filteredData);
                let response;
                if (filteredData) {
                    response = await axios.get(`/purchase_returns?start_date=${filteredData.start_date}&end_date=${filteredData.end_date}&${filteredData.supplier_id? supplier_id=filteredData.supplier_id : ""}&${filteredData.status_id? status_id=filteredData.status_id: ""}`);
                    this.returnList = response.data.data;
                } else {
                    response = await axios.get(`/purchase_returns`);
                    this.returnList = response.data.data;
                }
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchPurchaseReturn(id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/purchase_returns/${id}`);
                this.returnList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addPurchaseReturn(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/purchase_returns`, formData);
                this.returnList = response.data.data;
                console.log(response);
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editPurchaseReturn(formData, id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/purchase_returns/${id}`, formData);
                this.returnList = response.data.data;
                console.log(response);
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deletePurchaseReturn(data, id) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/purchase_returns/${id}`, { data: data});
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        },
    }
});