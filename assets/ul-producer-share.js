import { Component } from '@theme/component';

/**
 * Bloco de divulgacao da pagina do produtor (Etapa 3.13 - Urban Life):
 * input readonly com o link publico da horta + "Copiar link" (Clipboard
 * API com fallback via selecao do input + document.execCommand quando
 * navigator.clipboard nao estiver disponivel/permitido) e um botao
 * "Compartilhar" que so fica visivel quando `navigator.share` existe
 * (feature-detection no connectedCallback - sem isso, o botao permanece
 * `hidden`, como ja vem por padrao do Liquid, e "Copiar link" continua
 * sendo o unico caminho, que ja cobre 100% dos casos). Nao conhece nome
 * de produtor nenhum "de verdade" - so le o que ja vem pronto do Liquid
 * via `value`/`dataset`, entao funciona igual para qualquer horta.
 *
 * @typedef {object} Refs
 * @property {HTMLInputElement} input
 * @property {HTMLButtonElement} copyButton
 * @property {HTMLButtonElement} [shareButton]
 *
 * @extends {Component<Refs>}
 */
class UlProducerShareComponent extends Component {
  requiredRefs = ['input', 'copyButton'];

  /** @type {number | undefined} */
  #copyResetTimeout;

  connectedCallback() {
    super.connectedCallback();

    if (typeof navigator.share === 'function' && this.refs.shareButton) {
      this.refs.shareButton.hidden = false;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.#copyResetTimeout);
  }

  /** Bound declaratively via on:focus="/selectInput" no input readonly. */
  selectInput() {
    this.refs.input.select();
  }

  /** Bound declaratively via on:click="/copyLink" no botao "Copiar link". */
  async copyLink() {
    const { input, copyButton } = this.refs;

    const copied = await this.#writeToClipboard(input.value);
    if (!copied) return;

    window.clearTimeout(this.#copyResetTimeout);

    const originalLabel = copyButton.dataset.originalLabel ?? copyButton.textContent ?? 'Copiar link';
    copyButton.dataset.originalLabel = originalLabel;
    copyButton.textContent = 'Link copiado ✓';
    copyButton.dataset.copied = 'true';

    this.#copyResetTimeout = window.setTimeout(() => {
      copyButton.textContent = originalLabel;
      delete copyButton.dataset.copied;
    }, 2500);
  }

  /** Bound declaratively via on:click="/nativeShare" no botao "Compartilhar". */
  async nativeShare() {
    const button = this.refs.shareButton;
    if (!button) return;

    const { shareTitle, shareText, shareUrl } = button.dataset;

    try {
      await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
    } catch (error) {
      // AbortError acontece quando a pessoa fecha o menu nativo sem
      // escolher nada - nao e uma falha real, nao precisa de feedback.
      if (error instanceof Error && error.name === 'AbortError') return;

      if (window.Shopify?.designMode) {
        console.error('[ul-producer-share] Falha ao compartilhar:', error);
      }
    }
  }

  /**
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  async #writeToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        // Segue para o fallback abaixo (ex.: permissao negada em contexto nao seguro).
      }
    }

    const { input } = this.refs;
    input.focus();
    input.select();

    try {
      return document.execCommand('copy');
    } catch (error) {
      return false;
    }
  }
}

if (!customElements.get('ul-producer-share-component')) {
  customElements.define('ul-producer-share-component', UlProducerShareComponent);
}
