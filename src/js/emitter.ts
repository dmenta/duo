/* Avisos de cambio del estado: quien guarda estado lo extiende y avisa en cada cambio. */

/** Avisa a los suscriptos cada vez que el estado cambia */
export class Emitter<T> {
  #listeners = new Set<(change: T) => void>();

  /** @returns función para cancelar la suscripción */
  subscribe(listener: (change: T) => void) {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }

  protected emit(change: T) { for (const listener of this.#listeners) listener(change); }
}
