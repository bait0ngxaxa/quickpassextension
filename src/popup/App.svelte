<script>
  import { onDestroy, onMount } from "svelte";
  import PopupView from "./PopupView.svelte";
  import { createPopupController } from "./createPopupController.js";

  const controller = createPopupController();
  const view = controller.view;

  onMount(() => {
    void controller.init();
  });

  onDestroy(() => {
    controller.destroy();
  });
</script>

<PopupView view={$view} actions={controller} />
