import { defineStore } from "pinia";
import axios from "axios";
import { normalizeApiError } from "@/utils/NormalizeApiError";

export const useSalesReturnStore = defineStore('Sales Return', {
    state: () => ({
        returnList: [],
        loading: false,
        error: [],
        data: [],
        deleteLoading: false
    }),

    actions: {
        async fetchAllSalesReturn(filteredData) {
            this.loading = true;
            try {
                console.log(filteredData);
                let response;
                if (filteredData) {
                    response = await axios.get(`/sale_returns?start_date=${filteredData.start_date}&end_date=${filteredData.end_date}&${filteredData.customer_id? customer_id=filteredData.customer_id : ""}&${filteredData.status_id? status_id=filteredData.status_id: ""}`);
                    this.returnList = response.data.data;
                } else {
                    response = await axios.get(`/sales`);
                    this.returnList = response.data.data;
                }
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchSalesReturn(id) {
            this.loading = true;
            try {
                const response = await axios.get(`/sale_returns/${id}`);
                this.returnList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addSalesReturn(formData) {
            this.loading = true;
            try {
                const response = await axios.post(`/sale_returns`, formData);
                this.returnList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editSalesReturn(formData, id) {
            this.loading = true;
            try {
                const response = await axios.put(`/sale_returns/${id}`, formData);
                this.returnList = response.data.data;
                console.log(response);
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteSalesReturn(data, id) {
            this.deleteLoading = true;
            try {
                const response = await axios.delete(`/sale_returns/${id}`, { data: data});
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        },
    }
});