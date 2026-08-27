import { computed, template } from "vue";
import { VaporFor } from "vue-jsx-vapor";
import { VaporRouterLink } from "vue-router";
import Icon from "@/components/Icon";

type Props = {
	title: string;
	effectiveDate: string;
	intro: string;
	sections: LegalSection[];
};
type ParagraphBlock = Extract<LegalBlock, { type: "paragraph" }>;
type ListBlock = Extract<LegalBlock, { type: "list" }>;

export default function LegalPage(props: Props) {
	const introParagraphs = computed(() => props.intro.split("\n\n"));

	return (
		<>
			<div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
				<h2 class="mb-0">{props.title}</h2>
				<VaporRouterLink to="/notes" class="btn btn-secondary btn-sm">
					<Icon type="chevronLeft"/>
					<span class="ms-2">Back to Notes</span>
				</VaporRouterLink>
			</div>
			<article class="legal-content mx-auto">
				<p class="text-muted small mb-4">Last updated: {props.effectiveDate}</p>
				<VaporFor in={introParagraphs.value}>{(paragraph, index) => <p key={`intro-${index.value}`}>{paragraph}</p>}</VaporFor>
				<VaporFor in={props.sections}>
					{section => (
						<section key={section.heading} class="mt-4">
							<h3 class="h5 mb-3">{section.heading}</h3>
							<VaporFor in={section.blocks}>
								{(block, index) => (
									<template key={index.value}>
										<p v-if={block.type === `paragraph`} v-html={(block as ParagraphBlock).text}></p>
										<ul v-else class="mb-3">
											<VaporFor in={(block as ListBlock).items}>{(item, itemIndex) => <li key={itemIndex.value} class="mb-1" v-html={item}></li>}</VaporFor>
										</ul>
									</template>
								)}
							</VaporFor>
						</section>
					)}
				</VaporFor>
			</article>
		</>
	);
}