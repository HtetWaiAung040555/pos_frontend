<script setup>

    import PageTitle from '@/components/PageTitle.vue';
    import BaseButton from '@/components/BaseButton.vue';
    import BaseCard from '@/components/BaseCard.vue';
    import SubTitle from '@/components/SubTitle.vue';
    import { useRoute, useRouter } from 'vue-router';
    import BaseInput from '@/components/BaseInput.vue';
    import { onMounted, ref, watch } from 'vue';
    import { useToast } from 'primevue/usetoast';
    import BaseSwitch from '@/components/BaseSwitch.vue';
    import BaseLabel from '@/components/BaseLabel.vue';
    import { errMsgList } from '@/utils/const';
    import { useProductStore } from '@/stores/useProductStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useUnitStore } from '@/stores/useUnitStore';
import { Select } from 'primevue';
    
    const router = useRouter();
    const route = useRoute();
    const toast = useToast();
    const useProduct = useProductStore();
    const useCategory = useCategoryStore();
    const useUnit = useUnitStore();

    const formData = ref(
      {
        name: "",
        unit: "",
        sec_prop: "",
        price: 0,
        purchase_price: 0,
        barcode: "",
        image_url: "",
        status_id: "",
        created_by: "",
      }
    )
    const status = ref(true);
    const userData = ref({});
    const errorMsg = ref({
        name: "",
        price: "",
        unit: "",
    });
    const uploadImage = ref('');
    const selectedCategory = ref('');
    const selectedUnit = ref('');

    // Change route function
    function changeRoute(pathname) {
        router.push(pathname);
    }

    onMounted(async() => {
        userData.value = JSON.parse(localStorage.getItem('user'));
        await useProduct.fetchProduct(route.query.id);
        formData.value = useProduct.productList;
        formData.value.barcode = useProduct.productList.barcode === null? "" : useProduct.productList.barcode;
        uploadImage.value = useProduct.productList.image_url;
        status.value = formData.value.status.id === 1 ? true : false;
        await useCategory.fetchAllCategory();
        selectedCategory.value = useCategory.categoryList.filter(el => el.id === formData.value.category_id.id)[0];
        await useUnit.fetchAllUnit();
        selectedUnit.value = useUnit.unitList.filter(el => el.id === formData.value.unit_id.id)[0];
    });

    function onImageSelected(event) {
        const file = event.target.files[0];
        formData.value.image_url = file;
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadImage.value = e.target.result; // base64 string for preview
            };
            reader.readAsDataURL(file);
        }
    }

    // Create product function
    async function formSubmit() {
        if (formData.value.name === "") {
            errorMsg.value = {
                name: errMsgList.name,
                price: "",
                unit: "",
            };
            return
        } else if (formData.value.price <= 0) {
            errorMsg.value = {
                name: "",
                price: errMsgList.price,
                unit: "",
            };
            return
        } else if (!selectedUnit.value) {
            errorMsg.value = {
                name: "",
                price: "",
                unit: errMsgList.unit,
            }
            return
        }
        const fd = new FormData();
        fd.append("_method", "PUT")
        fd.append("name", formData.value.name);
        fd.append("unit_id", selectedUnit.value.id);
        fd.append("category_id", selectedCategory.value.id ? selectedCategory.value.id : '');
        fd.append("sec_prop", formData.value.sec_prop);
        fd.append("price", formData.value.price);
        fd.append("purchase_price", formData.value.purchase_price);
        fd.append("barcode", formData.value.barcode);
        fd.append("status_id", status.value? "1" : "2");
        fd.append("updated_by", userData.value.id);

        if (formData.value.image_url && typeof(formData.value.image_url) != "string") fd.append("image", formData.value.image_url);
        // formData.value = {
        //     ...formData.value,
        //     created_by: userData.value.id,
        //     status_id: status.value? '1' : '2'
        // };
        await useProduct.editProduct(route.query.id, fd);
        if(useProduct.error.length) {
            useProduct.error.forEach((msg) => {
                toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
                });
            });
            return
        }
        if (useProduct.productList) {
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'Product updated successfully.', life: 3000 });
            router.push('/product');
        }
    }

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Create Product">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" @click="changeRoute('/product')"  />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="flex gap-x-4 mt-6">
                    <!-- Image input -->
                    <div class="relative w-20 h-20 rounded-md">
                        <input 
                            id="productImage"
                            type="file"
                            accept="image/*"
                            class="w-full hidden z-10"
                            @change="onImageSelected"
                        />
                        <label
                            for="productImage"
                            :class="uploadImage? '' : 'border-2 border-dashed border-gray-300'"
                            class="flex cursor-pointer w-full h-full absolute text-3xl items-center justify-center rounded-md"
                        >
                            <i v-if="!uploadImage" class="fa fa-image"></i>
                        </label>
                        <img 
                            v-if="uploadImage" 
                            :src="uploadImage" 
                            :alt="uploadImage" 
                            class="object-cover w-full h-full rounded-md"
                        />
                    </div>
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- User Name Input -->
                    <BaseInput
                        size="sm"
                        v-model="formData.name"
                        label="Name"
                        placeholder="Name"
                        width="300px"
                        height="h-[35px]"
                        :isRequire="true"
                        :error="errorMsg.name"
                    />
                    <!-- Status -->
                    <div class="flex flex-col gap-y-1 w-[200px]">
                        <BaseLabel label="Status" />
                        <BaseSwitch v-model="status" />
                    </div>
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Category Select -->
                    <div class="flex flex-col gap-y-1">
                        <BaseLabel label="Category" />
                        <Select v-model="selectedCategory" :options="useCategory.categoryList" showClear filter
                            optionLabel="name" placeholder="Select category" class="w-[300px] h-[35px] items-center" />
                    </div>
                    <!-- Unit -->
                    <div class="flex flex-col gap-y-1">
                        <BaseLabel label="Unit" />
                        <Select v-model="selectedUnit" :options="useUnit.unitList" showClear filter optionLabel="name"
                            placeholder="Select unit" class="w-[300px] h-[35px] items-center" />
                    </div>
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Barcode Input -->
                    <BaseInput
                        size="sm"
                        v-model="formData.barcode"
                        label="Barcode"
                        placeholder="Barcode"
                        width="300px"
                        height="h-[35px]"
                    />
                    <!-- Secondary property input -->
                    <BaseInput
                        size="sm"
                        v-model="formData.sec_prop"
                        label="Secondary Property"
                        placeholder="Red, Green, Blue, ..."
                        width="300px"
                        height="h-[35px]"
                        :isRequire="true"
                        :error="errorMsg.sec_prop"
                    />
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Sales Price -->
                    <BaseInput
                        size="sm"
                        v-model="formData.price"
                        label="Sales Price"
                        width="300px"
                        height="h-[35px]"
                        type="number"
                        disabled
                    />
                    <!-- Price -->
                    <BaseInput
                        size="sm"
                        v-model="formData.purchase_price"
                        label="Purchase Price"
                        width="300px"
                        height="h-[35px]"
                        type="number"
                        disabled
                    />
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton 
                        label="Update" 
                        :isLoading="useProduct.loading" :icon="useProduct.loading? 'fa fa-spinner' : 'fa fa-floppy-disk'" 
                        severity="primary" 
                        @click="formSubmit" 
                        :disabled="useProduct.loading"  
                    />
                </div>
            </template>
        </BaseCard>
    </div>
</template>

