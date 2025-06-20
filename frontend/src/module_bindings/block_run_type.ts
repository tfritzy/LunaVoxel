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
import { MeshType as __MeshType } from "./mesh_type_type";
import { Vector3 as __Vector3 } from "./vector_3_type";

export type BlockRun = {
  type: __MeshType,
  color: number | undefined,
  topLeft: __Vector3,
  bottomRight: __Vector3,
};

/**
 * A namespace for generated helper functions.
 */
export namespace BlockRun {
  /**
  * A function which returns this type represented as an AlgebraicType.
  * This function is derived from the AlgebraicType used to generate this type.
  */
  export function getTypeScriptAlgebraicType(): AlgebraicType {
    return AlgebraicType.createProductType([
      new ProductTypeElement("type", __MeshType.getTypeScriptAlgebraicType()),
      new ProductTypeElement("color", AlgebraicType.createOptionType(AlgebraicType.createI32Type())),
      new ProductTypeElement("topLeft", __Vector3.getTypeScriptAlgebraicType()),
      new ProductTypeElement("bottomRight", __Vector3.getTypeScriptAlgebraicType()),
    ]);
  }

  export function serialize(writer: BinaryWriter, value: BlockRun): void {
    BlockRun.getTypeScriptAlgebraicType().serialize(writer, value);
  }

  export function deserialize(reader: BinaryReader): BlockRun {
    return BlockRun.getTypeScriptAlgebraicType().deserialize(reader);
  }

}


