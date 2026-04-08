package com.backend.decorator;

import com.backend.entity.Item;
import com.backend.dto.response.ItemResponse;
import org.springframework.stereotype.Component;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class BasicInfoDecorator implements ItemDecorator {

    @Override
    public ItemResponse decorate(Item item, ItemResponse response) {
        response.setId(item.getId());
        response.setName(item.getName());
        response.setCategory(item.getCategory());
        response.setSubtype(item.getSubtype());
        response.setSize(item.getSize());
        response.setColor(item.getColor());
        response.setPrice(item.getPrice());
        response.setStatus(item.getStatus());
        response.setAgeRange(item.getAgeRange());
        response.setDescription(item.getDescription());

        List<String> urls = parseList(item.getMediaUrls());
        List<String> types = parseList(item.getMediaTypes());
        List<ItemResponse.MediaFile> mediaFiles = new ArrayList<>();
        for (int i = 0; i < urls.size(); i++) {
            ItemResponse.MediaFile mf = new ItemResponse.MediaFile();
            mf.setUrl(urls.get(i));
            mf.setType(i < types.size() ? types.get(i) : "image");
            mediaFiles.add(mf);
        }
        response.setMediaFiles(mediaFiles);

        return response;
    }

    private List<String> parseList(String csv) {
        if (csv == null || csv.isBlank())
            return new ArrayList<>();
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }
}