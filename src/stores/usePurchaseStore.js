import { normalizeApiError } from "@/utils/NormalizeApiError";
import axios from "axios";
import { defineStore } from "pinia";

export const usePurchaseStore = defineStore('purchase', {
    state: () => ({
        purchaseList: [],
        loading: false,
        deleteLoading: false,
        error: [],
        data: null

    }),
    actions: {
        async fetchAllPurchase(filteredData) {
            this.loading = true;
            this.error = [];
            try {
                let response;
                if (filteredData) {
                    response = await axios.get(`/purchases?start_date=${filteredData.start_date}&end_date=${filteredData.end_date}&${filteredData.supplier_id? supplier_id=filteredData.supplier_id : ""}&${filteredData.status_id? status_id=filteredData.status_id: ""}`);
                    this.purchaseList = response.data.data;
                } else {
                    response = await axios.get(`/purchases`);
                    this.purchaseList = response.data.data;
                }
                
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
                console.log(response);
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
        }
    }

});