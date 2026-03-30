<script setup>
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import DetailRow from '@/components/DetailRow.vue';
import { statusBadgeHtml } from '@/utils/const';
import { useRoute, useRouter } from 'vue-router';
import { onMounted, ref } from 'vue';
import { usePriceChangeStore } from '@/stores/usePriceChangeStore';
import moment from 'moment';

const router = useRouter();
const route = useRoute();
const usePriceChange = usePriceChangeStore();

const selectedProducts = ref([]);
const formData = ref({
	id: '',
	description: '',
	type: '',
	startDate: '',
	status: '',
	createdBy: '',
	createdAt: '',
	updatedBy: '',
	updatedAt: ''
});

function formatPrice(value) {
	return Number(value || 0).toLocaleString('en-us');
}

// Navigate back to previous route with fallback
function goBack() {
	if (window.history.length > 1) {
		router.back();
	} else {
		router.push('/sales_price_change');
	}
}

onMounted(async () => {
	const priceChangeId = route.query.id || route.params.id;
	if (!priceChangeId) {
		goBack();
		return;
	}

	await usePriceChange.fetchPriceChange(priceChangeId);

	const priceChange = usePriceChange.priceChangeList || {};
	formData.value = {
		id: priceChange.id,
		description: priceChange.description || '',
		type: priceChange.type || '',
		startDate: priceChange.start_at || '',
		status: priceChange.status?.name || '',
		createdBy: priceChange.created_by?.name || '-',
		createdAt: priceChange.created_at || '',
		updatedBy: priceChange.updated_by?.name || '-',
		updatedAt: priceChange.updated_at || ''
	};

	selectedProducts.value = (priceChange.products || []).map((p) => ({
		id: p.product.id,
		name: p.product.name,
		image_url: p.product.image_url,
		old_price: Number(p.old_price) || 0,
		new_price: Number(p.price ?? p.new_price) || 0
	}));
});
</script>

<template>
	<div class="p-4">
		<PageTitle title="Sales Price Change Details">
			<template #titleButtons>
				<div class="flex gap-x-2 items-center">
					<BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" @click="goBack" />
				</div>
			</template>
		</PageTitle>

		<BaseCard class="mt-3 w-full">
			<template #cardElements>
				<SubTitle label="Basic Info" />

				<div class="grid lg:grid-cols-3 gap-x-4 mt-6">
					<div class="col-span-2 grid grid-cols-2 gap-2 h-fit">
						<DetailRow label="Price Change ID:" :value="formData.id" />
						<DetailRow label="Type:" :value="formData.type" :formatter="(v) => String(v || '').toUpperCase()" />
						<DetailRow label="Start Date" :value="formData.startDate" :formatter="(v) => moment(v).format('DD-MM-YYYY hh:mm:ss A')" />
						<DetailRow label="Description" :value="formData.description" />
					</div>

					<div class="grid grid-cols-1 gap-2 h-fit">
						<DetailRow label="Status:">
							<span v-html="statusBadgeHtml(formData.status)"></span>
						</DetailRow>
						<DetailRow label="Created By" :value="formData.createdBy" />
						<DetailRow label="Created At" :value="formData.createdAt" :formatter="(v) => moment(v).format('DD-MM-YYYY hh:mm:ss A')" />
						<DetailRow label="Updated By" :value="formData.updatedBy" />
						<DetailRow label="Updated At" :value="formData.updatedAt" :formatter="(v) => moment(v).format('DD-MM-YYYY hh:mm:ss A')" />
					</div>
				</div>
			</template>
		</BaseCard>

		<div class="mt-3 max-h-[350px] overflow-y-auto rounded">
			<table class="text-black w-full border-collapse border border-gray-200">
				<thead class="sticky top-0">
					<tr class="bg-gray-100 text-right">
						<th class="p-2 w-[50px]"></th>
						<th class="p-2 text-left">Image</th>
						<th class="p-2 text-left">Product Name</th>
						<th class="p-2">Sales Old Price</th>
						<th class="p-2">Sales New Price</th>
					</tr>
				</thead>
				<tbody>
					<tr
						class="hover:bg-blue-50 text-right"
						v-for="(product, index) in selectedProducts"
						:key="product.id"
					>
						<td class="border-b border-gray-200 p-2 text-center w-[50px]">{{ index + 1 }}.</td>
						<td class="border-b border-gray-200 p-2 text-left">
							<img :src="product.image_url" :alt="product.name" class="w-10 h-10 object-cover rounded" />
						</td>
						<td class="border-b border-gray-200 p-2 text-left">{{ product.name }}</td>
						<td class="border-b border-gray-200 p-2">{{ formatPrice(product.old_price) }}</td>
						<td class="border-b border-gray-200 p-2">{{ formatPrice(product.new_price) }}</td>
					</tr>
					<tr v-if="selectedProducts.length === 0">
						<td colspan="5" class="border-b border-gray-200 p-3 text-center text-gray-500">No products available</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>
