import { Address } from "../address";
import { Balance } from "../balance";
import { GasLimit } from "../networkParams";
import { SignableMessage } from "../signableMessage";
import { Transaction } from "../transaction";
import { TransactionPayload } from "../transactionPayload";
import { IDappProvider } from "./interface";

export class ExtensionProvider implements IDappProvider {
  private popupName = "connectPopup";
  private popupOptions =
    "directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,resizable=no,width=375,height=569";

  private extensionId: string = "";
  private extensionURL: string = "";
  private extensionPopupWindow: Window | null;
  private account: any;

  constructor(extensionId: string) {
    this.extensionId = extensionId;
    this.extensionURL = `chrome-extension://${this.extensionId}/index.html`;
    this.extensionPopupWindow = null;
    this.init().then();
  }

  private openExtensionPopup() {
    this.extensionPopupWindow = window.open(
      this.extensionURL,
      this.popupName,
      this.popupOptions
    );
  }

  private startExtMsgChannel(
    operation: string,
    connectData: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      var isResolved = false;
      const eventHandler = (event: any) => {
        if (
          event.isTrusted &&
          event.data.type &&
          event.data.target === "erdw-extension"
        ) {
          switch (event.data.type) {
            case "popupReady":
              console.log("popup ready");
              event.ports[0].postMessage({
                target: "erdw-inpage",
                type: operation,
                data: connectData,
              });
              break;
            case "connectResult":
              this.extensionPopupWindow?.close();
              this.account = event.data.data;
              window.removeEventListener("message", eventHandler);
              isResolved = true;
              resolve(event.data.data);
              break;
            default:
              this.extensionPopupWindow?.close();
              window.removeEventListener("message", eventHandler);
              isResolved = true;
              resolve(event.data.data);
              break;
          }
        }
      };
      var windowCloseInterval = setInterval(() => {
        if (this.extensionPopupWindow?.closed) {
          window.removeEventListener("message", eventHandler);
          clearInterval(windowCloseInterval);
          if (!isResolved)
            reject("Extension window was closed without response.");
        }
      }, 500);

      window.addEventListener("message", eventHandler, false);
    });
  }

  async init(): Promise<boolean> {
    return true;
  }

  async login(
    options: {
      callbackUrl?: string;
      token?: string;
    } = {}
  ): Promise<string> {
    this.openExtensionPopup();
    const { token } = options;
    const data = token ? token : "";
    return await this.startExtMsgChannel("connect", data);
  }

  async logout(): Promise<boolean> {
    return true;
  }

  async getAddress(): Promise<string> {
    return this.account.address;
  }

  isInitialized(): boolean {
    return true;
  }

  async isConnected(): Promise<boolean> {
    return true;
  }

  async sendTransaction(transaction: Transaction): Promise<Transaction> {
    return (await this.processTransactions([transaction], false))[0];
  }

  async signTransaction(transaction: Transaction): Promise<Transaction> {
    return (await this.processTransactions([transaction], true))[0];
  }

  async sendTransactions(
    transactions: Array<Transaction>
  ): Promise<Array<Transaction>> {
    return await this.processTransactions(transactions, false);
  }

  async signTransactions(
    transactions: Array<Transaction>
  ): Promise<Array<Transaction>> {
    return await this.processTransactions(transactions, true);
  }

  async processTransactions(
    transactions: Array<Transaction>,
    signOnly: boolean
  ): Promise<Array<Transaction>> {
    this.openExtensionPopup();
    const data = {
      from: this.account.index,
      transactions: transactions,
      signOnly,
    };

    return await this.startExtMsgChannel("transaction", data);
  }

  async signMessage(message: SignableMessage): Promise<SignableMessage> {
    this.openExtensionPopup();
    const data = {
      account: this.account.index,
      message: message.message,
    };
    return await this.startExtMsgChannel("signMessage", data);
  }
}
