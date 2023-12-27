import { getMetadataArgsStorage } from "../globals"
import { GeneratedMetadataArgs } from "../metadata-args/GeneratedMetadataArgs"

/**
 * Marks a column to generate a value on entity insertion.
 * There are three types of generation strategy - increment, and uuid.
 * Increment uses a number which increases by one on each insertion.
 * Uuid generates a special UUID token.
 *
 * Note, some databases do not support non-primary generation columns.
 */
export function Generated(
    strategy: "increment" | "uuid" = "increment",
): PropertyDecorator {
    return function (object: Object, propertyName: string) {
        getMetadataArgsStorage().generations.push({
            target: object.constructor,
            propertyName: propertyName,
            strategy: strategy,
        } as GeneratedMetadataArgs)
    }
}
