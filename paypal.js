// Name: PayPal (Client-Side)
// ID: paypalClient
// Description: Accept PayPal payments and donations via a popup overlay.
// By: Assistant
// License: MIT

(function (Scratch) {
  'use strict';

  // State variables
  let paypalSdkLoaded = false;
  let currentClientId = '';
  let currentCurrency = 'USD';
  let lastTransactionStatus = 'none'; // none, success, cancelled, error
  let lastTransactionId = '';

  // UI Elements
  let overlayContainer = null;
  let paypalButtonContainer = null;

  class PayPalExtension {
    getInfo() {
      return {
        id: 'paypalClient',
        name: 'PayPal',
        color1: '#003087', // PayPal Blue
        color2: '#0079C1', // PayPal Light Blue
        color3: '#001C53',
        blocks: [
          {
            opcode: 'initialize',
            blockType: Scratch.BlockType.COMMAND,
            text: 'setup PayPal with Client ID [CLIENTID] and currency [CURRENCY]',
            arguments: {
              CLIENTID: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'YOUR_CLIENT_ID_HERE'
              },
              CURRENCY: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'USD',
                menu: 'currencies'
              }
            }
          },
          '---',
          {
            opcode: 'requestPayment',
            blockType: Scratch.BlockType.COMMAND,
            text: 'request payment of [AMOUNT]',
            arguments: {
              AMOUNT: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 5.00
              }
            }
          },
          '---',
          {
            opcode: 'isSuccessful',
            blockType: Scratch.BlockType.BOOLEAN,
            text: 'last payment successful?'
          },
          {
            opcode: 'getStatus',
            blockType: Scratch.BlockType.REPORTER,
            text: 'last payment status'
          },
          {
            opcode: 'getTransactionId',
            blockType: Scratch.BlockType.REPORTER,
            text: 'last transaction ID'
          }
        ],
        menus: {
          currencies: {
            acceptReporters: true,
            items: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'BRL', 'MXN']
          }
        }
      };
    }

    _createUI() {
      if (overlayContainer) return;

      // Create a full-screen dark overlay
      overlayContainer = document.createElement('div');
      overlayContainer.style.position = 'fixed';
      overlayContainer.style.top = '0';
      overlayContainer.style.left = '0';
      overlayContainer.style.width = '100vw';
      overlayContainer.style.height = '100vh';
      overlayContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
      overlayContainer.style.zIndex = '999999';
      overlayContainer.style.display = 'none';
      overlayContainer.style.justifyContent = 'center';
      overlayContainer.style.alignItems = 'center';
      overlayContainer.style.flexDirection = 'column';
      overlayContainer.style.fontFamily = 'sans-serif';

      // Create a white modal box
      const modal = document.createElement('div');
      modal.style.backgroundColor = 'white';
      modal.style.padding = '30px';
      modal.style.borderRadius = '10px';
      modal.style.width = '400px';
      modal.style.maxWidth = '90%';
      modal.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
      modal.style.textAlign = 'center';
      modal.style.position = 'relative';

      // Docs button (NUEVO)
      const docsBtn = document.createElement('a');
      docsBtn.innerText = '📄 Docs';
      docsBtn.href = 'https://developer.paypal.com/docs/checkout/';
      docsBtn.target = '_blank';
      docsBtn.style.position = 'absolute';
      docsBtn.style.top = '10px';
      docsBtn.style.left = '10px';
      docsBtn.style.fontSize = '14px';
      docsBtn.style.color = '#0079C1';
      docsBtn.style.textDecoration = 'none';
      docsBtn.style.fontWeight = 'bold';

      // Close button
      const closeBtn = document.createElement('button');
      closeBtn.innerText = '✖ Cancel';
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '10px';
      closeBtn.style.right = '10px';
      closeBtn.style.background = 'none';
      closeBtn.style.border = 'none';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.fontSize = '14px';
      closeBtn.style.color = '#666';
      
      closeBtn.onclick = () => {
        this._hideUI();
        if (this._currentResolve) {
          lastTransactionStatus = 'cancelled';
          this._currentResolve(); // Resolve the block without success
        }
      };

      const title = document.createElement('h2');
      title.innerText = 'Complete Checkout';
      title.style.margin = '20px 0 20px 0'; // Ajustado para dar espacio a los botones de arriba
      title.style.color = '#333';

      paypalButtonContainer = document.createElement('div');
      paypalButtonContainer.id = 'scratch-paypal-button-container';

      modal.appendChild(docsBtn);
      modal.appendChild(closeBtn);
      modal.appendChild(title);
      modal.appendChild(paypalButtonContainer);
      overlayContainer.appendChild(modal);
      document.body.appendChild(overlayContainer);
    }

    _hideUI() {
      if (overlayContainer) {
        overlayContainer.style.display = 'none';
      }
    }

    _showUI() {
      if (!overlayContainer) this._createUI();
      overlayContainer.style.display = 'flex';
      paypalButtonContainer.innerHTML = ''; // Clear old buttons
    }

    initialize(args) {
      const clientId = Scratch.Cast.toString(args.CLIENTID);
      const currency = Scratch.Cast.toString(args.CURRENCY);

      // If we already loaded exactly this configuration, don't do it again
      if (paypalSdkLoaded && clientId === currentClientId && currency === currentCurrency) {
        return;
      }

      return new Promise((resolve, reject) => {
        // Remove old script if it exists
        const oldScript = document.getElementById('paypal-sdk-script');
        if (oldScript) oldScript.remove();
        if (window.paypal) delete window.paypal; // clear existing instance

        const script = document.createElement('script');
        script.id = 'paypal-sdk-script';
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}`;
        script.onload = () => {
          paypalSdkLoaded = true;
          currentClientId = clientId;
          currentCurrency = currency;
          resolve();
        };
        script.onerror = () => {
          console.error('Failed to load PayPal SDK. Check your Client ID.');
          paypalSdkLoaded = false;
          resolve(); // Resolve anyway so the block doesn't freeze the project forever
        };
        document.head.appendChild(script);
      });
    }

    requestPayment(args) {
      const amount = Scratch.Cast.toNumber(args.AMOUNT).toFixed(2);

      // We return a Promise. The Scratch block will PAUSE until this Promise resolves.
      return new Promise((resolve) => {
        this._currentResolve = resolve;
        this._showUI(); // Show UI first so errors are visible!
        lastTransactionStatus = 'pending';
        lastTransactionId = '';

        if (!paypalSdkLoaded || !window.paypal) {
          console.warn('PayPal SDK is not initialized. Please run the setup block first.');
          lastTransactionStatus = 'error';
          paypalButtonContainer.innerHTML = '<p style="color:red; font-weight:bold; margin-top:20px;">Error: PayPal failed to load.</p><p style="font-size:14px; color:#555;">Did you run the setup block first?<br>Is your Client ID valid?</p>';
          return;
        }

        if (amount <= 0) {
          console.warn('Amount must be greater than 0');
          lastTransactionStatus = 'error';
          paypalButtonContainer.innerHTML = '<p style="color:red; font-weight:bold; margin-top:20px;">Error: Amount must be greater than 0.</p>';
          return;
        }

        // Render the PayPal button
        try {
          window.paypal.Buttons({
            style: {
              layout: 'vertical',
              color: 'blue',
              shape: 'rect',
              label: 'paypal'
            },
            createOrder: (data, actions) => {
              // CORREGIDO: Se reinserta el código completo de la orden
              return actions.order.create({
                purchase_units: [{
                  amount: {
                    value: amount.toString()
                  }
                }]
              });
            },
            onApprove: (data, actions) => {
              // CORREGIDO: Se reinserta el código para capturar el pago
              return actions.order.capture().then((details) => {
                lastTransactionStatus = 'success';
                lastTransactionId = details.id;
                this._hideUI();
                resolve(); // Continue the Scratch script
              });
            },
            onCancel: (data) => {
              lastTransactionStatus = 'cancelled';
              this._hideUI();
              resolve(); // Continue the Scratch script
            },
            onError: (err) => {
              console.error('PayPal Error:', err);
              lastTransactionStatus = 'error';
              paypalButtonContainer.innerHTML = '<p style="color:red; font-weight:bold; margin-top:20px;">A PayPal error occurred.</p><p style="font-size:14px;">Check the browser console (F12) for details.</p>';
              // Don't auto-resolve here so the user can read the error; they must click Cancel
            }
          }).render(paypalButtonContainer).catch(err => {
             console.error('PayPal Render Error:', err);
             lastTransactionStatus = 'error';
             paypalButtonContainer.innerHTML = '<p style="color:red; font-weight:bold; margin-top:20px;">Failed to render PayPal buttons.</p><p style="font-size:14px; color:#555;">Your Client ID might be invalid.</p>';
          });
        } catch (e) {
          console.error('PayPal Error:', e);
          lastTransactionStatus = 'error';
          paypalButtonContainer.innerHTML = `<p style="color:red; font-weight:bold; margin-top:20px;">Error:</p><p style="font-size:14px; color:#555;">${e.message}</p>`;
        }
      });
    }

    isSuccessful() {
      return lastTransactionStatus === 'success';
    }

    getStatus() {
      return lastTransactionStatus;
    }

    getTransactionId() {
      return lastTransactionId;
    }
  }

  Scratch.extensions.register(new PayPalExtension());
})(Scratch);
