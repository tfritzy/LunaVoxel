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

export type DeleteAtlasIndex = {
  projectId: string,
  index: number,
  gridSize: number,
  cellPixelWidth: number,
  usedSlots: number,
};

/**
 * A namespace for generated helper functions.
 */
export namespace DeleteAtlasIndex {
  /**
  * A function which returns this type represented as an AlgebraicType.
  * This function is derived from the AlgebraicType used to generate this type.
  */
  export function getTypeScriptAlgebraicType(): AlgebraicType {
    return AlgebraicType.createProductType([
      new ProductTypeElement("projectId", AlgebraicType.createStringType()),
      new ProductTypeElement("index", AlgebraicType.createI32Type()),
      new ProductTypeElement("gridSize", AlgebraicType.createI32Type()),
      new ProductTypeElement("cellPixelWidth", AlgebraicType.createI32Type()),
      new ProductTypeElement("usedSlots", AlgebraicType.createI32Type()),
    ]);
  }

  export function serialize(writer: BinaryWriter, value: DeleteAtlasIndex): void {
    DeleteAtlasIndex.getTypeScriptAlgebraicType().serialize(writer, value);
  }

  export function deserialize(reader: BinaryReader): DeleteAtlasIndex {
    return DeleteAtlasIndex.getTypeScriptAlgebraicType().deserialize(reader);
  }

}

