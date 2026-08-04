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

    const errorElement = button.closest('.ul-weekly-basket__panel-footer')?.parentElement?.querySelector(
      '.ul-weekly-basket__cart-error'
    );
    const originalLabel = button.textContent;

    button.dataset.loading = 'true';
    button.setAttribute('aria-disabled', 'true');
    button.textContent = 'Adicionando...';
    errorElement?.setAttribute('hidden', '');

    try {
      const response = await fetch(Theme.routes.cart_add_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          items: [{ id: Number(variantId), quantity: 1 }],
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
