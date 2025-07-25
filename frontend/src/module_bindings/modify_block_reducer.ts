// THIS FILE IS AUTOMATICALLY GENERATED BY SPACETIMEDB. EDITS TO THIS FILE
// WILL NOT BE SAVED. MODIFY TABLES IN YOUR MODULE SOURCE CODE INSTEAD.

/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
import {
  AlgebraicType,
  AlgebraicValue,
  BinaryReader,
  BinaryWriter,
  CallReducerFlags,
  ConnectionId,
  DbConnectionBuilder,
  DbConnectionImpl,
  DbContext,
  ErrorContextInterface,
  Event,
  EventContextInterface,
  Identity,
  ProductType,
  ProductTypeElement,
  ReducerEventContextInterface,
  SubscriptionBuilderImpl,
  SubscriptionEventContextInterface,
  SumType,
  SumTypeVariant,
  TableCache,
  TimeDuration,
  Timestamp,
  deepEqual,
} from "@clockworklabs/spacetimedb-sdk";

import { BlockModificationMode as __BlockModificationMode } from "./block_modification_mode_type";
import { Vector3 as __Vector3 } from "./vector_3_type";

export type ModifyBlock = {
  projectId: string,
  mode: __BlockModificationMode,
  blockType: number,
  positions: __Vector3[],
  rotation: number,
  layerIndex: number,
};

/**
 * A namespace for generated helper functions.
 */
export namespace ModifyBlock {
  /**
  * A function which returns this type represented as an AlgebraicType.
  * This function is derived from the AlgebraicType used to generate this type.
  */
  export function getTypeScriptAlgebraicType(): AlgebraicType {
    return AlgebraicType.createProductType([
      new ProductTypeElement("projectId", AlgebraicType.createStringType()),
      new ProductTypeElement("mode", __BlockModificationMode.getTypeScriptAlgebraicType()),
      new ProductTypeElement("blockType", AlgebraicType.createI32Type()),
      new ProductTypeElement("positions", AlgebraicType.createArrayType(__Vector3.getTypeScriptAlgebraicType())),
      new ProductTypeElement("rotation", AlgebraicType.createI32Type()),
      new ProductTypeElement("layerIndex", AlgebraicType.createI32Type()),
    ]);
  }

  export function serialize(writer: BinaryWriter, value: ModifyBlock): void {
    ModifyBlock.getTypeScriptAlgebraicType().serialize(writer, value);
  }

  export function deserialize(reader: BinaryReader): ModifyBlock {
    return ModifyBlock.getTypeScriptAlgebraicType().deserialize(reader);
  }

}

