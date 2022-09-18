/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createEventDispatcher, type ComponentEvents, type ComponentProps } from 'svelte';
import { writable } from 'svelte/store';

import type {
  PushedModal,
  ModalPushInput,
  ModalComponentBase,
  ModalPushOutput,
  ModalComponentBaseResolved,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ExtendedModalEvents,
  ModalInternalResolver,
} from './modal.types';

type ApplicableModal = PushedModal<ModalComponentBase>;

/**
 * Create a svelte store for handling modal
 * @public
 *
 * @example
 *
 * ```typescript
 * import { createModalStore } from '@svelte-put/modal';
 * const store = createModalStore();
 * ```
 *
 * @returns extended svelte store
 */
export function createModalStore() {
  const { subscribe, set } = writable<ApplicableModal[]>([]);
  let modals: ApplicableModal[] = [];
  const resolveMap: Record<string, undefined | ModalInternalResolver> = {};

  /**
   * Push a new modal to the stack
   *
   * @param input - {@link ModalPushInput}
   * @returns the {@link ModalPushOutput}
   */
  function push<
    Component extends ModalComponentBase,
    Resolved extends ModalComponentBaseResolved = ComponentEvents<Component>['resolve']['detail'],
  >(input: ModalPushInput<Component>): ModalPushOutput<Component> {
    let _resolve: ModalInternalResolver<Resolved> | undefined;
    const promise = new Promise<Resolved>((resolve) => {
      _resolve = resolve;
    });

    let pushed: PushedModal<Component>;
    if (typeof input === 'function') {
      pushed = {
        id: crypto.randomUUID(),
        component: input,
        props: {} as ComponentProps<Component>,
      };
    } else {
      pushed = {
        id: crypto.randomUUID(),
        props: {} as ComponentProps<Component>,
        ...input,
      };
    }

    modals.push(pushed);
    resolveMap[pushed.id] = _resolve as unknown as ModalInternalResolver;

    set([...modals]);

    return {
      id: pushed.id,
      resolve: () => promise,
    };
  }

  /**
   * Pop the modal with given id.
   * If `id` is not provided, pop the topmost modal
   *
   * @remarks
   *
   * When calling this manually (rather than being called from the `ModalPortal` component),
   * the trigger is expected to be `pop`;
   *
   * @param id - from the return of `push` method
   * @param resolved - custom resolved value, if any
   * @returns the popped {@link PushedModal} or `undefined` in the
   * case no modal was found that matches the specified input
   */
  function pop<Resolved extends ModalComponentBaseResolved>(id?: string, resolved?: Resolved) {
    let popped: ApplicableModal | undefined;
    if (id) {
      modals = modals.filter((modal) => {
        if (modal.id === id) {
          popped = modal;
          return false;
        }
        return true;
      });
      set(modals);
    } else {
      popped = modals.pop();
      set([...modals]);
    }
    if (popped) {
      resolveMap[popped.id]?.({
        trigger: 'pop',
        ...(resolved ?? {})
      });
      resolveMap[popped.id] = undefined;
    }
    return popped;
  }

  return {
    subscribe,
    push,
    pop,
  };
}

/**
 * Helper that wraps svelte `createEventDispatcher` for creating typesafe
 * event dispatcher from the `$$Events` type. See {@link ExtendedModalEvents}
 *
 * @returns svelte event dispatcher
 */
export function createModalEventDispatcher<Events extends Record<string, CustomEvent<any>>>() {
  return createEventDispatcher<{
    [key in keyof Events]: Events[key]['detail'];
  }>();
}
