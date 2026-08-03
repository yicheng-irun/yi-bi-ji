-keepattributes *Annotation*, InnerClasses
-dontwarn org.slf4j.**
-dontwarn okhttp3.**
-dontwarn okio.**
-keepclassmembers,allowshrinking,allowobfuscation class * {
    @kotlinx.serialization.Serializable <methods>;
}
