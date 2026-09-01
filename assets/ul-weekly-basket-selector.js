import { Component } from '@theme/component';

/**
 * Seletor de tamanho de cesta (P/M/G) da "Selecao da semana", no perfil
 * do produtor (Etapa 3.6 - Urban Life). Os 3 paineis completos (titulo,
 * preco, disponibilidade, itens, link) ja vem prontos do Liquid - este
 * componente alterna qual painel fica visivel (`hidden`) e mantem
 * aria-selected/tabindex em sincronia, e agora tambem adiciona a
 * variante escolhida ao carrinho via Ajax Cart API. Nao conhece nomes
 * de produto nem de alimento, entao funciona igual para qualquer
 * produtor.
 *
 * Adicionar ao carrinho: cada link "Escolher Cesta X" com
 * `data-variant-id` valido e interceptado (o `href` real para a pagina
 * do produto com `?variant=` fica como fallback se o JS nao rodar).
 * POST para `Theme.routes.cart_add_url` (global do tema, injetado em
 * snippets/scripts.liquid - ja inclui o `.js` e o prefixo de
 * loja/idioma corretos; este tema nao usa `window.Shopify.routes.root`,
 * entao NUNCA fixamos uma URL absoluta aqui). Em caso de sucesso,
 * redireciona para `Theme.routes.cart_url` (nunca para a pagina do
 * produto, nunca para o checkout). O estado de carregamento e o erro
 * (mensagem `role="alert"`, sem alert() do navegador) ficam isolados
 * por botao via `dataset`, entao varias instancias deste componente na
 * mesma pagina nao interferem entre si e nao ha variavel global nova.
 *
 * Troca de 1 item por cesta (MVP): cada painel tem um widget
 * `[data-swap-widget]` com um `<select>` de origem e um de destino,
 * ambos preenchidos 100% pelo Liquid a partir de `items_p/m/g` (nenhum
 * item e inventado aqui). Ao mudar a origem, a opcao correspondente e
 * desabilitada no `<select>` de destino, para nunca permitir trocar um
 * item por ele mesmo. `#getSwapFromPanel` so retorna uma troca quando
 * origem e destino estao preenchidos e sao diferentes - qualquer estado
 * incompleto (so origem escolhida, por exemplo) e tratado como "sem
 * troca" na hora de montar as `properties`. `addToCart` sempre inclui
 * `_ul_config_id` (gerado a cada clique, nunca reaproveitado) para que
 * o Shopify nunca funda, numa mesma linha do carrinho, duas adicoes
 * distintas cujas properties visiveis coincidam (ex.: duas cestas sem
 * troca, ou com a mesma troca) - a fusao so acontece quando TODAS as
 * properties de duas linhas sao identicas, entao um ID unico por adicao
 * garante linhas sempre separadas por unidade/configuracao.
 *
 * @typedef {object} Refs
 * @property {HTMLButtonElement[]} tabs
 * @property {HTMLElement[]} panels
 *
 * @extends {Component<Refs>}
 */
class UlWeeklyBasketSelectorComponent extends Component {
  requiredRefs = ['tabs', 'panels'];

  /**
   * Bound declaratively via on:click="/select/{size}" on each tab.
   * @param {string} size
   */
  select(size) {
    this.#activate(size);
  }

  /** @param {KeyboardEvent} event */
  onKeydown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    const tabs = this.refs.tabs;
    const currentIndex = tabs.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
    if (currentIndex === -1) return;

    event.preventDefault();

    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextTab = tabs[(currentIndex + delta + tabs.length) % tabs.length];
    const size = nextTab?.dataset.size;
    if (!size) return;

    nextTab.focus();
    this.#activate(size);
  }

  /**
   * Bound declaratively via on:click="/addToCart" em cada link "Escolher
   * Cesta X" que tiver `data-variant-id` (variantes esgotadas ou ainda
   * nao configuradas renderizam um <button disabled> sem esse atributo
   * e sem este handler, entao nunca disparam requisicao).
   * @param {MouseEvent} event
   */
  async addToCart(event) {
    const button = /** @type {HTMLAnchorElement} */ (event.target);
    const variantId = button?.dataset.variantId;
    if (!variantId) return;

    // Deixa o <a href="...?variant=..."> funcionar normalmente como
    // fallback se, por algum motivo, este handler for chamado sem o JS
    // do carrinho ter carregado direito - mas a partir daqui a
    // navegacao padrao e sempre interceptada.
    event.preventDefault();

    if (button.dataset.loading === 'true') return;

    const panel = button.closest('.ul-weekly-basket__panel');
    const errorElement = button.closest('.ul-weekly-basket__panel-footer')?.parentElement?.querySelector(
      '.ul-weekly-basket__cart-error'
    );
    const originalLabel = button.textContent;

    button.dataset.loading = 'true';
    button.setAttribute('aria-disabled', 'true');
    button.textContent = 'Adicionando...';
    errorElement?.setAttribute('hidden', '');

    const swap = panel ? this.#getSwapFromPanel(panel) : null;

    /** @type {Record<string, string>} */
    const properties = { _ul_config_id: this.#generateConfigId() };
    if (swap) {
      properties['Troca solicitada'] = `${swap.origin} → ${swap.destination}`;
      properties['_troca_de'] = swap.origin;
      properties['_troca_por'] = swap.destination;
    }

    try {
      const response = await fetch(Theme.routes.cart_add_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          items: [{ id: Number(variantId), quantity: 1, properties }],
        }),
      });

      const data = await response.json();

      if (!response.ok || data.status) {
        throw new Error(data?.message || `cart/add.js respondeu ${response.status}`);
      }

      button.textContent = 'Adicionado!';
      window.location.href = Theme.routes.cart_url;
    } catch (error) {
      if (window.Shopify?.designMode) {
        console.error('[ul-weekly-basket-selector] Falha ao adicionar ao carrinho:', error);
      }

      button.textContent = originalLabel;
      button.dataset.loading = 'false';
      button.removeAttribute('aria-disabled');

      if (errorElement) {
        errorElement.textContent = 'Não foi possível adicionar esta cesta. Tente novamente.';
        errorElement.removeAttribute('hidden');
      }
    }
  }

  /**
   * Bound declaratively via on:change="/onSwapOriginChange" em cada
   * <select data-swap-origin>. Desabilita, no <select> de destino, a
   * opcao igual a origem escolhida (nunca deixa trocar um item por ele
   * mesmo) e limpa o destino se ele apontava justamente para a nova
   * origem.
   * @param {Event} event
   */
  onSwapOriginChange(event) {
    const originSelect = /** @type {HTMLSelectElement} */ (event.target);
    const widget = originSelect.closest('[data-swap-widget]');
    if (!widget) return;

    const destinationSelect = /** @type {HTMLSelectElement | null} */ (
      widget.querySelector('[data-swap-destination]')
    );
    if (!destinationSelect) return;

    const origin = originSelect.value;

    for (const option of destinationSelect.options) {
      option.disabled = option.value !== '' && option.value === origin;
    }

    if (destinationSelect.value === origin) {
      destinationSelect.value = '';
    }

    destinationSelect.disabled = origin === '';

    this.#hideSwapSummary(widget);
  }

  /**
   * Bound declaratively via on:change="/onSwapDestinationChange" em
   * cada <select data-swap-destination>. So mostra o resumo quando
   * origem e destino estao preenchidos e sao diferentes.
   * @param {Event} event
   */
  onSwapDestinationChange(event) {
    const destinationSelect = /** @type {HTMLSelectElement} */ (event.target);
    const widget = destinationSelect.closest('[data-swap-widget]');
    if (!widget) return;

    const originSelect = /** @type {HTMLSelectElement | null} */ (widget.querySelector('[data-swap-origin]'));
    const origin = originSelect?.value ?? '';
    const destination = destinationSelect.value;

    if (!origin || !destination || origin === destination) {
      this.#hideSwapSummary(widget);
      return;
    }

    this.#showSwapSummary(widget, origin, destination);
  }

  /**
   * Bound declaratively via on:click="/removeSwap" no botao "Remover
   * troca". Volta o widget para o estado inicial (sem troca).
   * @param {MouseEvent} event
   */
  removeSwap(event) {
    const button = /** @type {HTMLButtonElement} */ (event.target);
    const widget = button.closest('[data-swap-widget]');
    if (!widget) return;

    this.#resetSwap(widget);
  }

  /**
   * @param {Element} widget
   * @param {string} origin
   * @param {string} destination
   */
  #showSwapSummary(widget, origin, destination) {
    const summary = widget.querySelector('[data-swap-summary]');
    const summaryValue = widget.querySelector('[data-swap-summary-value]');
    const picker = widget.querySelector('[data-swap-picker]');
    if (!summary || !summaryValue || !picker) return;

    summaryValue.textContent = `${origin} → ${destination}`;
    summary.removeAttribute('hidden');
    picker.setAttribute('hidden', '');
  }

  /** @param {Element} widget */
  #hideSwapSummary(widget) {
    const summary = widget.querySelector('[data-swap-summary]');
    const picker = widget.querySelector('[data-swap-picker]');
    summary?.setAttribute('hidden', '');
    picker?.removeAttribute('hidden');
  }

  /** @param {Element} widget */
  #resetSwap(widget) {
    const originSelect = /** @type {HTMLSelectElement | null} */ (widget.querySelector('[data-swap-origin]'));
    const destinationSelect = /** @type {HTMLSelectElement | null} */ (
      widget.querySelector('[data-swap-destination]')
    );

    if (originSelect) originSelect.value = '';

    if (destinationSelect) {
      destinationSelect.value = '';
      destinationSelect.disabled = true;
      for (const option of destinationSelect.options) {
        option.disabled = false;
      }
    }

    this.#hideSwapSummary(widget);
  }

  /**
   * Le a troca confirmada (se houver) direto do DOM do painel - nunca
   * de um estado em JS separado, entao nao ha como divergir do que o
   * cliente realmente tem selecionado nos <select>s no momento do
   * clique em "Escolher Cesta X".
   * @param {Element} panel
   * @returns {{ origin: string, destination: string } | null}
   */
  #getSwapFromPanel(panel) {
    const widget = panel.querySelector('[data-swap-widget]');
    if (!widget) return null;

    const originSelect = /** @type {HTMLSelectElement | null} */ (widget.querySelector('[data-swap-origin]'));
    const destinationSelect = /** @type {HTMLSelectElement | null} */ (
      widget.querySelector('[data-swap-destination]')
    );

    const origin = originSelect?.value ?? '';
    const destination = destinationSelect?.value ?? '';

    if (!origin || !destination || origin === destination) return null;

    return { origin, destination };
  }

  /**
   * ID unico por adicao ao carrinho (nunca reaproveitado entre
   * cliques), sem nenhum significado de negocio - serve so para
   * impedir que o Shopify funda, numa mesma linha, duas
   * adicoes/configuracoes cujas demais properties coincidam.
   * @returns {string}
   */
  #generateConfigId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `ul-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  /** @param {string} size */
  #activate(size) {
    this.refs.tabs.forEach((tab) => {
      const active = tab.dataset.size === size;
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
    });

    this.refs.panels.forEach((panel) => {
      panel.hidden = panel.dataset.size !== size;
    });
  }
}

if (!customElements.get('ul-weekly-basket-selector-component')) {
  customElements.define('ul-weekly-basket-selector-component', UlWeeklyBasketSelectorComponent);
}
