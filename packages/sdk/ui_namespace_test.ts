// /packages/sdk/ui_namespace_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { UIBuilder } from "./ui.ts";

Deno.test("keyboard namespace prefixes callback data", () => {
	const kb = UIBuilder.keyboard()
		.namespace("svc1")
		.callback("A", "alpha")
		.row()
		.callback("B", "svc:other|beta") // should not double prefix
		.build();

	const [row1, row2] = kb.buttons;
	assertEquals(row1[0].action.type, "callback");
	if (row1[0].action.type === "callback") {
		assertEquals(row1[0].action.data, "svc:svc1|alpha");
	}
	assertEquals(row2[0].action.type, "callback");
	if (row2[0].action.type === "callback") {
		assertEquals(row2[0].action.data, "svc:other|beta");
	}
});

Deno.test("menu namespace applies to callback buttons", () => {
	const menu = UIBuilder.menu("Test")
		.namespace("mservice")
		.callback("One", "one")
		.callback("Two", "svc:already|two")
		.build();

	assertEquals(menu.buttons[0].action.type, "callback");
	if (menu.buttons[0].action.type === "callback") {
		assertEquals(menu.buttons[0].action.data, "svc:mservice|one");
	}
	assertEquals(menu.buttons[1].action.type, "callback");
	if (menu.buttons[1].action.type === "callback") {
		assertEquals(menu.buttons[1].action.data, "svc:already|two");
	}
});

Deno.test("card namespace applies to callback actions", () => {
	const card = UIBuilder.card("Card")
		.namespace("cardsvc")
		.callback("Do", "doit")
		.callback("Raw", "svc:raw|keep")
		.build();

	if (card.actions) {
		assertEquals(card.actions[0].action.type, "callback");
		if (card.actions[0].action.type === "callback") {
			assertEquals(card.actions[0].action.data, "svc:cardsvc|doit");
		}
		assertEquals(card.actions[1].action.type, "callback");
		if (card.actions[1].action.type === "callback") {
			assertEquals(card.actions[1].action.data, "svc:raw|keep");
		}
	}
});
