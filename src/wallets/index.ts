import Web3 from 'web3'

import {
  IChainToAccounts,
  IChainWithAccount,
  IProviderOptions,
  SimpleFunction
} from '../helpers'
import { IChainType, WALLETS_EVENTS } from '../constants'
import { WalletConnect } from '../core'

export class WalletsConnector {
  private web3: Web3 | null = null

  public connector: WalletConnect
  private accounts: IChainWithAccount = {}

  constructor(
    providerOptions: IProviderOptions,
    network = 'mainnet',
    cacheProvider = true
  ) {
    const connector = new WalletConnect({
      network,
      cacheProvider,
      providerOptions
    })

    this.connector = connector

    this.connect()
  }

  private connect = () => {
    try {
      this.connector
        .connect()
        .then((provider: any) => {
          this.web3 = new Web3(provider)
          return provider.enable()
        })
        .then((ethAccounts: string[]) => {
          return this.loadAccounts(ethAccounts)
        })
    } catch (e) {
      console.log('Error', e)

      setTimeout(() => this.connect(), 1000)
    }
  }

  private loadAccounts = async (ethAccounts: string[]) => {
    if (!this.web3) {
      return
    }

    const accounts = await this.connector.loadAccounts()

    const map = accounts.reduce((acc: any, item: IChainToAccounts) => {
      acc[item.chain] = item.accounts
      return acc
    }, {})

    map[IChainType.ethereum] = ethAccounts

    this.setAccounts(map)

    this.connector.trigger(
      WALLETS_EVENTS.CURRENT_WALLET,
      this.connector.injectedProvider
    )
    this.connector.trigger(
      WALLETS_EVENTS.CONNECTED_CHAINS,
      this.connector.injectedChains
    )
  }

  private setAccounts = (map: IChainWithAccount) => {
    this.accounts = map
    this.connector.trigger(WALLETS_EVENTS.ACCOUNTS, this.accounts)
  }

  public getBalance = async (chain: IChainType = IChainType.ethereum) => {
    if (!this.web3) {
      return 0
    }

    switch (chain) {
      case IChainType.ethereum: {
        return this.web3.eth.getBalance(this.accounts[chain][0])
      }
      default: {
        throw Error('Not supported chain for loading balance')
      }
    }
  }

  public disconnect = () => {
    this.connector.clearCachedProvider()

    this.setAccounts({})

    this.connector.trigger(
      WALLETS_EVENTS.CURRENT_WALLET,
      this.connector.injectedProvider
    )
    this.connector.trigger(
      WALLETS_EVENTS.CONNECTED_CHAINS,
      this.connector.injectedChains
    )
  }

  public getChainMethods = (chain: IChainType) => {
    const chains = this.connector.injectedProvider?.chains
    return chains ? chains[chain] : undefined
  }

  public signMessage = async (chainId: IChainType, hash: string) => {
    if (!this.web3) {
      return
    }

    const address = this.getAddress(chainId)

    switch (chainId) {
      case IChainType.ethereum: {
        return await this.web3.eth.sign(hash, address)
      }

      default: {
        const targetProvider = this.getChainMethods(chainId)
        if (targetProvider && targetProvider.methods.signTransaction) {
          return await targetProvider.methods.signTransaction(hash)
        }
      }
    }
  }

  public request = async (chainId: IChainType, type: string, data: any) => {
    const targetProvider = this.getChainMethods(chainId)

    if (targetProvider && targetProvider.methods.request) {
      return await targetProvider.methods.request(type, data)
    }

    throw new Error(`Not supported ${type} for ${chainId}`)
  }

  public on = (event: string, callback: SimpleFunction) => {
    this.connector.on(event, callback)
  }

  public off(event: string, callback?: SimpleFunction): void {
    this.connector.off(event, callback)
  }

  private getAccounts = (): IChainWithAccount => {
    return this.accounts
  }

  private getAddress = (chainId: IChainType): string => {
    const accounts = this.getAccounts()

    return accounts[chainId][0] as string
  }
}
