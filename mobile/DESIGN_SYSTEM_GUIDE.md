# Design System Quick Reference Guide

## 🎨 How to Use the New Design System

This guide helps you apply the modernized Material 3 design patterns to all screens in the mobile admin app.

---

## 📏 Spacing Reference

Always use `@dimen/` references, never hardcode dimensions:

```xml
<!-- Small gaps between elements -->
android:layout_marginTop="@dimen/spacing_xs"     <!-- 4dp -->

<!-- Standard padding & margins -->
android:padding="@dimen/spacing_lg"              <!-- 16dp -->
android:layout_margin="@dimen/spacing_md"        <!-- 12dp -->

<!-- Section spacing -->
android:layout_marginTop="@dimen/spacing_xl"     <!-- 24dp -->

<!-- Large containers -->
android:layout_margin="@dimen/spacing_2xl"       <!-- 32dp -->
```

---

## 🎯 Typography Reference

Use text styles defined in `values/themes.xml`:

```xml
<!-- Headings -->
<TextView
    android:text="Attendance"
    style="@style/Text.Headline.Large" />

<!-- Titles -->
<TextView
    android:text="Staff Name"
    style="@style/Text.Title.Large" />

<!-- Body text -->
<TextView
    android:text="email@example.com"
    style="@style/Text.Body.Small" />

<!-- Labels -->
<TextView
    android:text="Active"
    style="@style/Text.Label.Medium" />
```

---

## 🎨 Components & Patterns

### Pattern 1: Modern Card Item (List Item)

```xml
<com.google.android.material.card.MaterialCardView
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginHorizontal="@dimen/spacing_md"
    android:layout_marginVertical="@dimen/spacing_sm"
    app:cardCornerRadius="@dimen/corner_radius_lg"
    app:cardElevation="@dimen/elevation_sm"
    android:foreground="?attr/selectableItemBackground">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:padding="@dimen/spacing_lg"
        android:minHeight="@dimen/card_min_height"
        android:gravity="center_vertical">

        <!-- Content here -->
    </LinearLayout>
</com.google.android.material.card.MaterialCardView>
```

### Pattern 2: Circular Avatar

```xml
<com.google.android.material.card.MaterialCardView
    android:layout_width="@dimen/avatar_size_lg"
    android:layout_height="@dimen/avatar_size_lg"
    app:cardCornerRadius="@dimen/corner_radius_full"
    app:cardElevation="0dp">

    <TextView
        android:id="@+id/tvInitials"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:gravity="center"
        android:textSize="@dimen/text_title_large"
        android:textStyle="bold"
        android:textColor="#FFFFFF" />
</com.google.android.material.card.MaterialCardView>
```

### Pattern 3: Status Badge

```xml
<com.google.android.material.card.MaterialCardView
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    app:cardCornerRadius="@dimen/corner_radius_md"
    app:cardElevation="0dp">

    <TextView
        android:id="@+id/tvStatus"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:textSize="@dimen/text_label_small"
        android:textStyle="bold"
        android:paddingHorizontal="@dimen/spacing_md"
        android:paddingVertical="@dimen/spacing_sm"
        android:gravity="center" />
</com.google.android.material.card.MaterialCardView>
```

### Pattern 4: Header with Actions

```xml
<LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:background="@color/brand_burgundy"
    android:padding="@dimen/spacing_lg"
    android:elevation="@dimen/elevation_md"
    android:orientation="vertical">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Title"
        android:textColor="#FFFFFF"
        android:textSize="@dimen/text_headline_large"
        android:textStyle="bold" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Subtitle"
        android:textColor="#FFFFFF"
        android:textSize="@dimen/text_body_small"
        android:alpha="0.8"
        android:layout_marginTop="@dimen/spacing_xs" />
</LinearLayout>
```

### Pattern 5: Primary & Secondary Buttons

```xml
<!-- Primary Button -->
<com.google.android.material.button.MaterialButton
    android:id="@+id/btnPrimary"
    android:layout_width="0dp"
    android:layout_height="@dimen/button_height"
    android:layout_weight="1"
    android:text="Save"
    android:textAllCaps="false"
    style="@style/Widget.Material3.Button.FilledButton"
    app:backgroundTint="@color/brand_burgundy" />

<!-- Secondary (Outline) Button -->
<com.google.android.material.button.MaterialButton
    android:id="@+id/btnSecondary"
    android:layout_width="0dp"
    android:layout_height="@dimen/button_height"
    android:layout_weight="1"
    android:text="Cancel"
    android:textAllCaps="false"
    style="@style/Widget.Material3.Button.OutlinedButton"
    app:strokeColor="@color/brand_gold"
    android:textColor="@color/brand_burgundy" />
```

### Pattern 6: Empty State

```xml
<LinearLayout
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:gravity="center"
    android:padding="@dimen/spacing_2xl">

    <ImageView
        android:layout_width="@dimen/spacing_3xl"
        android:layout_height="@dimen/spacing_3xl"
        android:src="@drawable/ic_visibility_off"
        android:tint="@color/brand_text_subtitle"
        android:alpha="0.5"
        android:layout_marginBottom="@dimen/spacing_lg" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="No items found"
        style="@style/Text.Body.Medium"
        android:gravity="center" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Start by creating something new"
        style="@style/Text.Body.Small"
        android:layout_marginTop="@dimen/spacing_sm"
        android:alpha="0.7" />
</LinearLayout>
```

### Pattern 7: Modern FAB

```xml
<com.google.android.material.floatingactionbutton.FloatingActionButton
    android:id="@+id/fab"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:layout_gravity="bottom|end"
    android:layout_margin="@dimen/spacing_lg"
    app:backgroundTint="@color/brand_burgundy"
    app:srcCompat="@android:drawable/ic_input_add"
    app:tint="#FFFFFF"
    app:elevation="@dimen/elevation_lg"
    app:pressedTranslationZ="@dimen/elevation_xl" />
```

---

## 🎨 Color System

```xml
<!-- Primary (Burgundy) -->
android:textColor="@color/brand_burgundy"
app:backgroundTint="@color/brand_burgundy"

<!-- Secondary (Gold) -->
app:strokeColor="@color/brand_gold"

<!-- Text Colors -->
android:textColor="@color/brand_text_dark"           <!-- Main text -->
android:textColor="@color/brand_text_subtitle"       <!-- Secondary text -->

<!-- Status Colors (for badges) -->
android:background="@color/status_pending_bg"
android:background="@color/status_confirmed_bg"
android:background="@color/status_cancelled_bg"

<!-- Semantic Colors -->
android:textColor="@color/success_green"
android:textColor="@color/error_red"
android:textColor="@color/warning_amber"
```

---

## 📱 Common Screen Patterns

### Pattern: List Screen with Header

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="@color/brand_cream_bg">

    <!-- Toolbar -->
    <androidx.appcompat.widget.Toolbar
        android:id="@+id/toolbar"
        android:layout_width="match_parent"
        android:layout_height="?attr/actionBarSize"
        android:background="@color/brand_burgundy"
        android:title="Customers"
        android:titleTextColor="#FFFFFF"
        app:navigationIcon="@drawable/ic_arrow_back"
        app:navigationIconTint="#FFFFFF"
        android:elevation="@dimen/elevation_md" />

    <!-- Search Bar -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:background="@color/brand_surface"
        android:padding="@dimen/spacing_lg"
        android:elevation="@dimen/elevation_sm">

        <EditText
            android:id="@+id/etSearch"
            android:layout_width="match_parent"
            android:layout_height="@dimen/button_height_small"
            android:background="@drawable/bg_input_field"
            android:hint="Search…"
            android:paddingHorizontal="@dimen/spacing_md"
            android:singleLine="true"
            android:inputType="text" />
    </LinearLayout>

    <!-- List with Pull-to-Refresh -->
    <androidx.swiperefreshlayout.widget.SwipeRefreshLayout
        android:id="@+id/swipeRefresh"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1">

        <androidx.recyclerview.widget.RecyclerView
            android:id="@+id/recyclerView"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:paddingVertical="@dimen/spacing_md"
            android:clipToPadding="false" />
    </androidx.swiperefreshlayout.widget.SwipeRefreshLayout>
</LinearLayout>
```

---

## ✅ Checklist Before Submitting Layout

- [ ] Used `@dimen/` for all spacing (no hardcoded dp)
- [ ] Used `@dimen/` for all text sizes (no hardcoded sp)
- [ ] Used text styles from `values/themes.xml`
- [ ] Used Material 3 components (MaterialCardView, MaterialButton)
- [ ] Corner radius: lg(12dp) for cards, md(8dp) for badges
- [ ] Elevation: sm(1dp) for subtle, md(2dp) for cards
- [ ] Minimum touch target: 48dp for buttons
- [ ] Padding: consistent 16dp for cards, 12dp for sections
- [ ] Empty state: icon + heading + subtitle
- [ ] Typography hierarchy: clear levels
- [ ] Color contrast: text readable on background
- [ ] Ripple effects: foreground="?attr/selectableItemBackground"

---

## 🚀 Before/After Comparison

### List Item Before

```
Basic text, inconsistent spacing, no visual hierarchy
```

### List Item After

```
┌─────────────────────────────────┐
│ [Avatar]  Name (Bold)           │
│           email@example.com      │
│           Subtitle • Days        │   [Status]
└─────────────────────────────────┘
Card: 12dp radius, 2dp shadow
Spacing: 16dp padding, consistent alignment
```

---

## 📚 File References

- **Dimensions**: `values/dimens.xml`
- **Themes/Styles**: `values/themes.xml`
- **Colors**: `values/colors.xml`
- **Buttons**: `drawable/bg_button_*.xml`
- **Badges**: `drawable/bg_badge_*.xml`

---

## ❓ Common Questions

**Q: How do I make a rounded button?**  
A: Use `MaterialButton` with `style="@style/Widget.Material3.Button.FilledButton"` and `app:backgroundTint="@color/brand_burgundy"`

**Q: How do I space elements consistently?**  
A: Use `@dimen/spacing_lg` (16dp) for padding and `@dimen/spacing_md` (12dp) for margins between cards.

**Q: How do I make an avatar?**  
A: Use `MaterialCardView` with `app:cardCornerRadius="@dimen/corner_radius_full"` and place `TextView` inside for initials.

**Q: How do I create an empty state?**  
A: Create a LinearLayout with icon (32-48dp), heading (bold, 18sp), and subtitle (14sp, lighter color).

**Q: Can I use custom drawables?**  
A: Prefer Material 3 components. If needed, place in `drawable/` and reference with `@drawable/ic_*`.

---

**Remember**: Consistency creates polish. Always reference dimens and styles—never hardcode values!
